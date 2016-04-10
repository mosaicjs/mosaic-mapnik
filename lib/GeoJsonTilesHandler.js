var fs = require('fs');
var geojsonvt = require('geojson-vt');
var mapnik = require('mapnik');
var vtpbf = require('vt-pbf')
var TilesHandler = require('./TilesHandler');
var Utils = require('./Utils');
var ninvoke = Utils.ninvoke;
var extend = Utils.extend;

function GeoJsonTilesHandler(options) {
    options = options || {};
    this.initialize(options);
}
extend(GeoJsonTilesHandler.prototype, TilesHandler.prototype, {

    _loadSerializedVectorTile : function(params, query) {
        var that = this;
        return that._getIndexes().then(function(indexes) {
            var x = +params.x;
            var y = +params.y;
            var z = +params.z;
            var layers = {};

            var list = that._getLayersInfo(query.layer //
                    || query.layers //
                    || Object.keys(indexes));
            list.map(function(info) {
                var tileIndex = indexes[info.layer];
                if (!tileIndex)
                    return;
                var tile = tileIndex.getTile(z, x, y);
                if (!tile)
                    return;
                layers[info.layer] = tile;
            });
            var buffer = vtpbf.fromGeojsonVt(layers);
            return buffer;
        });
    },

    _loadVectorTile : function(params, query) {
        // return TilesHandler.prototype._loadVectorTile.apply(this, arguments);
        var that = this;
        return that._loadSerializedVectorTile(params, query).then(
                function(buffer) {
                    var x = +params.x;
                    var y = +params.y;
                    var z = +params.z;
                    var vtile = new mapnik.VectorTile(z, x, y, {
                        buffer_size : 64,
                        bufferSize : 64,
                        tileSize : 4096
                    });
                    if (!buffer || !buffer.length)
                        return vtile;
                    return ninvoke(vtile, vtile.setData, buffer).then(
                            function() {
                                return vtile;
                            });
                });
    },

    // ------------------------------------------------------------------------

    _mergeGeoJsonObjects : function(list) {
        var json;
        if (list.length > 1) {
            var features = [];
            list.map(function(obj) {
                features = features.concat(obj.features);
            });
            json = {
                type : 'FeatureCollection',
                features : features
            };
        } else if (list.length > 0) {
            json = list[0];
        } else {
            json = {
                type : 'FeatureCollection',
                features : []
            };
        }
        return json;
    },

    _loadGeoJson : function(list) {
        var that = this;
        return Promise.resolve().then(function() {
            if (!list)
                return [];
            if (!Array.isArray(list))
                list = [ list ];
            return Promise.all(list.map(function(json) {
                if (typeof json === 'string') {
                    return that._readFile(json, 'UTF-8')//
                    .then(function(str) {
                        return JSON.parse(str);
                    });
                } else {
                    return Promise.resolve(json);
                }
            })).then(function(list) {
                return that._mergeGeoJsonObjects(list);
            });
        })
    },

    _readFile : function(file, encoding) {
        return ninvoke(fs, fs.readFile, file, encoding);
    },

    _buildTilesIndexFromJson : function(json) {
        return Promise.resolve().then(function() {
            return geojsonvt(json, {
                maxZoom : 22, // max zoom to preserve detail on
                // tolerance : 10, // simplification tolerance (higher means
                // simpler)
                tolerance : 3, // simplification tolerance (higher means
                // simpler)
                extent : 4096, // tile extent (both width and height)
                buffer : 1024, // tile buffer on each side
                debug : 0, // logging level (0 to disable, 1 or 2)
                //
                // indexMaxZoom: 4, // max zoom in the initial tile
                // // index
                indexMaxPoints : 100000, // max number of points per tile
                // the index
                solidChildren : false
            // whether to include solid tile
            // children in the index
            });
        });
    },

    _getIndexes : function() {
        var that = this;
        if (that._tileIndexPromise)
            return that._tileIndexPromise;
        return that._tileIndexPromise = Promise.resolve()//
        .then(function() {
            var result = {};
            var data = that.options.data || that.options.files;
            if (Array.isArray(data)) {
                data = {
                    'default' : data
                }
            }
            return Promise.all(Object.keys(data).map(function(key) {
                return that._loadGeoJson(data[key]).then(function(json) {
                    return that._buildTilesIndexFromJson(json)//
                    .then(function(index) {
                        if (index) {
                            result[key] = index;
                        }
                    });
                });
            })).then(function() {
                return result;
            });
        });
    },

});

module.exports = GeoJsonTilesHandler;