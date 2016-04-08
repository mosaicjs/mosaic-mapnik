var fs = require('fs');
var geojsonvt = require('geojson-vt');
var mapnik = require('mapnik');
var vtpbf = require('vt-pbf')
var TilesHandler = require('./TilesHandler');
var Utils = require('./Utils');
var ninvoke = Utils.ninvoke;
var extend = Utils.extend;

function CustomTilesHandler(options) {
    options = options || {};
    this.initialize(options);
}
extend(CustomTilesHandler.prototype, TilesHandler.prototype, {

    _readFile : function(file, encoding) {
        return ninvoke(fs, fs.readFile, file, encoding);
    },
    _readFiles : function(files, encoding) {
        return Promise.all((files || []).map(function(file) {
            return this._readFile(file, encoding);
        }, this));
    },
    _readJson : function(files) {
        var that = this;
        return that._readFiles(files, 'UTF-8').then(function(array) {
            return array.map(JSON.parse);
        });
    },

    _buildTilesIndex : function(files) {
        var that = this;
        return Promise.resolve().then(function() {
            if (!files)
                return [];
            if (!Array.isArray(files)) {
                files = [ files ];
            }
            return that._readJson(files, 'UTF-8');
        }).then(function(list) {
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
            }
            if (!json)
                return;
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

    _getTilesIndex : function() {
        var that = this;
        if (that._tileIndexPromise)
            return that._tileIndexPromise;
        return that._tileIndexPromise = Promise.resolve()//
        .then(function() {
            var files = that.options.files;
            if (Array.isArray(files)) {
                files = {
                    'default' : files
                };
            }
            var result = {};
            return Promise.all(Object.keys(files).map(function(key) {
                result[key] = null;
                return that._buildTilesIndex(files[key]).then(function(index) {
                    if (index) {
                        result[key] = index;
                    }
                });
            })).then(function() {
                return result;
            });
        })
    },

    _loadVectorTile : function(params, query) {
        // return TilesHandler.prototype._loadVectorTile.apply(this, arguments);
        var that = this;
        return that._getTilesIndex().then(function(indexes) {
            var x = +params.x;
            var y = +params.y;
            var z = +params.z;
            var layers = {};
            var names = query.layer || query.layers;
            if (names) {
                if (!Array.isArray(names)) {
                    names = names.split(/[,;]/);
                }
            } else {
                names = Object.keys(indexes);
            }
            names.map(function(name) {
                var tileIndex = indexes[name];
                if (!tileIndex)
                    return;
                var tile = tileIndex.getTile(z, x, y);
                if (!tile)
                    return;
                layers[name] = tile;
            });
            var vtile = new mapnik.VectorTile(z, x, y, {
                buffer_size : 64,
                bufferSize : 64,
                tileSize : 4096
            });
            var buffer = vtpbf.fromGeojsonVt(layers);
            if (!buffer || !buffer.length)
                return vtile;
            return ninvoke(vtile, vtile.setData, buffer).then(function() {
                return vtile;
            });
        });
    }

});

module.exports = CustomTilesHandler;