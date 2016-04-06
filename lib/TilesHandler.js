var RendererLoader = require('./RendererLoader');

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

    _renderVectorTile : function(vtile, params, query) {
        var that = this;
        return that._loadRenderer().then(function(renderer) {
            var info = {
                x : +params.x,
                y : +params.y,
                z : +params.z,
                vtile : vtile,
                format : params.type === 'png' ? 'png' : 'utf'
            }
            if (info.format === 'utf') {
                info.layer = query.layer;
                if (!info.layer) {
                    var layers = vtile.names();
                    info.layer = layers[0];
                }
                ;
                var fields = query.fields || '';
                if (fields[0] === '[') {
                    info.fields = JSON.parse(fields);
                } else {
                    info.fields = fields.split(',');
                }
            }
            return renderer.renderVectorTile(info);
        });
    },

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
        }).then(function(tile) {
            if (tile instanceof Buffer) {
                res.set('Content-Type', 'image/png');
                res.send(tile);
            } else {
                var cb = query.cb;
                var json = JSON.stringify(tile, null, 2);
                if (cb) {
                    res.set('Content-Type', 'application/javascript');
                    res.send(cb + '(' + json + ')');
                } else {
                    res.set('Content-Type', 'application/json');
                    res.send(json);
                }
            }
        }, function(err) {
            res.status(500).send({
                message : err.message,
                stack : err.stack
            });
        });

    },

}

module.exports = TilesHandler;