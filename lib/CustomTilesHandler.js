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
    _getTileIndex : function() {
        var that = this;
        if (that._tileIndexPromise)
            return that._tileIndexPromise;
        return that._tileIndexPromise = Promise.resolve()//
        .then(function() {
            return that._readJson(that.options.files, 'UTF-8') //
            .then(function(array) {
                var features = [];
                array.map(function(json) {
                    features = features.concat(json.features);
                });
                var collection = {
                    type : 'FeatureCollection',
                    features : features
                }
                return geojsonvt(collection, {
                    maxZoom : 22, // max zoom to preserve detail on
//                    tolerance : 10, // simplification tolerance (higher means simpler)
                    tolerance : 3, // simplification tolerance (higher means simpler)
                    extent: 4096, // tile extent (both width and height)
                    buffer : 64, // tile buffer on each side
                    debug : 0, // logging level (0 to disable, 1 or 2)
                    //
                    // indexMaxZoom: 4, // max zoom in the initial tile
                    // // index
                    indexMaxPoints : 100000, // max number of points per tile
                                                // in
                    // the index
                    solidChildren : false
                // whether to include solid tile
                // children in the index
                });
            });
        })
    },

    _loadVectorTile : function(params, query) {
        // return TilesHandler.prototype._loadVectorTile.apply(this, arguments);
        var that = this;
        return that._getTileIndex().then(function(tileIndex) {
            var x = +params.x;
            var y = +params.y;
            var z = +params.z;

            var tile = tileIndex.getTile(z, x, y);
            var buffer;
            if (tile) {
                buffer = vtpbf.fromGeojsonVt({
                    'tc' : tile
                });
            }

            var vtile = new mapnik.VectorTile(z, x, y, {
                buffer_size : 64,
                bufferSize : 64,
                tileSize : 4096
            });
            if (!buffer)
                return vtile;
            return ninvoke(vtile, vtile.setData, buffer).then(function() {
                return vtile;
            })
        });
    }

});

module.exports = CustomTilesHandler;