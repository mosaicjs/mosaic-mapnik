var fs = require('fs');
var geojsonvt = require('geojson-vt');
var vtpbf = require('vt-pbf')
var TilesProvider = require('./TilesProvider');
var parseLayersInfo = require('./parseLayersInfo');
var Utils = require('../Utils');
var GeoJsonUtils = require('../GeoJsonUtils');
var ninvoke = Utils.ninvoke;
var extend = Utils.extend;

var mapnik = require('mapnik');

function GeoJsonToPbf(options) {
    this.initialize(options);
}
extend(GeoJsonToPbf.prototype, TilesProvider.prototype, {

    initialize : function(options) {
        this.options = options || {};
    },

    loadTile : function(options) {
        var that = this;
        return that._getIndexes(options).then(function(indexes) {
            var params = options.params || {};
            var query = options.query || {};
            var x = +params.x;
            var y = +params.y;
            var z = +params.z;
            var layers = {};
            var list = parseLayersInfo(query.layer //
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
            return extend({}, options, {
                tile : buffer,
                headers : {
                    'Content-Type' : 'application/x-protobuf'
                }
            });
        });
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

    _getIndexes : function(options) {
        var that = this;
        // TODO: add a cache/timeout
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
                return GeoJsonUtils.merge(list);
            });
        })
    },

    _readFile : function(file, encoding) {
        return ninvoke(fs, fs.readFile, file, encoding);
    },

});
module.exports = GeoJsonToPbf;
