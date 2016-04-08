var RendererLoader = require('./RendererLoader');
var UtfGridMerge = require('./UtfGridMerge');
var Utils = require('./Utils');
var extend = Utils.extend;

function TilesHandler() {
    this.initialize.apply(this, arguments);
}
TilesHandler.prototype = {

    initialize : function(options) {
        this.options = options || {};
    },

    _loadRenderer : function() {
        var that = this;
        return Promise.resolve().then(function() {
            if (!that._renderer) {
                that._renderer = that._getLoader().then(function(loader) {
                    return loader.getRenderer('style');
                });
            }
            return that._renderer;
        })
    },

    _loadVectorTile : function(params, query) {
        var that = this;
        return loadSource().then(function(source) {
            return source.buildVectorTile(params).then(function(info) {
                return info.vtile;
            });
        });
        function loadSource() {
            return Promise.resolve().then(function() {
                if (!that._source) {
                    that._source = that._getLoader().then(function(loader) {
                        return loader.getRenderer('source');
                    });
                }
                return that._source;
            })
        }
    },

    /**
     * Renders the specified vector tile to different formats. Returns an object
     * containing two fields: 1) 'content' the resulting data (Buffer, object or
     * string) 2) 'headers' HTTP headers fields describing the returned content
     */
    _renderVectorTile : function(vtile, params, query) {
        var that = this;
        return Promise.resolve().then(function() {
            var info = {
                x : +params.x,
                y : +params.y,
                z : +params.z,
                vtile : vtile,
            };
            if (params.type === 'pbf' //
                    || params.type === 'vector.pbf') {
                info.format = 'pbf';
                return that._transformToBuffer(vtile, query, info);
            } else if (params.type === 'utf' //
                    || params.type === 'json' //
                    || params.type === 'jsonp') {
                info.format = 'utf';
                return that._transformToUtfGrid(vtile, query, info);
            } else {
                info.format = 'png';
                return that._transformToImage(vtile, query, info);
            }
        });
    },

    // ------------------------------------------------------------------------
    // Transforms vector tiles to other formats

    _transformToBuffer : function(vtile, query, info) {
        return Promise.resolve().then(function() {
            var buffer = vtile.getData();
            return {
                content : buffer,
                headers : {
                    'Content-Type' : 'application/x-protobuf'
                }
            };
        });
    },

    _toArray : function(val, delimiter) {
        if (!val)
            return [];
        if (val[0] === '[' || val[0] === '{') {
            val = JSON.parse(val);
        }
        if (typeof val === 'string') {
            val = val.split(delimiter);
        }
        if (!Array.isArray(val)) {
            val = [ val ];
        }
        return val;
    },

    _getLayerFilds : function(vtile, layer) {
        var json = JSON.parse(vtile.toGeoJSON(layer));
        var index = {};
        function addFields(feature) {
            var props = feature.properties || {};
            Object.keys(props).forEach(function(prop) {
                index[prop] = true;
            });
        }
        if (json.type == 'FeatureCollection') {
            json.features.forEach(addFields);
        } else {
            addFields(json);
        }
        var fields = Object.keys(index);
        return fields;
    },

    /**
     * Format of layers for UTFGrids :
     * ?layer=firstlayer:field1,field2,field3&layer=second:fieldA,fieldB,fieldC
     * OR ?layer=firstlayer:field1,field2,field3;second:fieldA,fieldB,fieldC
     */
    _transformToUtfGrid : function(vtile, query, info) {
        var that = this;
        return that._loadRenderer().then(function(renderer) {
            var layers = query.layer || query.layers || vtile.names();
            layers = that._toArray(layers, ';');
            var fields = that._toArray(query.fields, ',');
            var promise = Promise.all(layers.map(function(layer) {
                var arr = layer.split(':');
                var options = extend({}, info);
                options.layer = arr[0];
                options.fields = that._toArray(arr[1], ',');
                if (!options.fields.length) {
                    options.fields = fields;
                }
                if (!options.fields.length) {
                    options.fields = that._getLayerFilds(vtile, layer);
                }
                return renderer.renderVectorTile(options).then(function(grid) {
                    return grid;
                });
            }));
            return promise.then(function(grids) {
                return UtfGridMerge(grids);
            });
        }).then(function(tile) {
            var result;
            var cb = query.cb;
            if (cb) {
                var json = JSON.stringify(tile, null, 2);
                result = {
                    content : cb + '(' + json + ')',
                    headers : {
                        'Content-Type' : 'application/javascript'
                    }
                };
            } else {
                result = {
                    content : JSON.stringify(tile, null, 2),
                    headers : {
                        'Content-Type' : 'application/json'
                    }
                };
            }
            return result;
        });
    },

    _transformToImage : function(vtile, query, info) {
        var that = this;
        return that._loadRenderer().then(function(renderer) {
            return renderer.renderVectorTile(info);
        }).then(function(image) {
            return {
                content : image,
                headers : {
                    'Content-Type' : 'image/png'
                }
            };
        });
    },

    // ------------------------------------------------------------------------

    _getLoader : function() {
        var that = this;
        return that._loader = that._loader
                || Promise.resolve().then(function() {
                    return new RendererLoader(that.options);
                });
    },

    handle : function(req, res, next) {
        var that = this;
        var query = req.query || {};
        var params = req.params;
        params.z = +params.z;
        params.x = +params.x;
        params.y = +params.y;
        return Promise.resolve().then(function() {
            return that._loadVectorTile(params, query)//
            .then(function(vtile) {
                return that._renderVectorTile(vtile, params, query);
            })
        }).then(function(result) {
            res.set(result.headers);
            res.send(result.content);
        }, function(err) {
            res.status(500).send({
                message : err.message,
                stack : err.stack
            });
        });

    },

}

module.exports = TilesHandler;