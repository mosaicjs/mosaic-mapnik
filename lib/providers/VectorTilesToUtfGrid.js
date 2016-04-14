var MapnikTilesProvider = require('./MapnikTilesProvider');
var Utils = require('../Utils');
var UtfGridMerge = require('./UtfGridMerge');
var parseLayersInfo = require('./parseLayersInfo');
var extend = Utils.extend;

/**
 * Serializes provided mapnik.VectorTile instance as a buffer. Expects a
 * mapnik.VectorTile instance in the options.tile. Returns a buffer-serialized
 * version of the tile.
 * 
 * @param options
 */
function VectorTilesToUtfGrid(options) {
    this.initialize(options);
}

extend(VectorTilesToUtfGrid.prototype, MapnikTilesProvider.prototype, {
    loadTile : function(options) {
        var that = this;
        return that._loadStyleRenderer().then(function(renderer) {
            var query = extend({}, options.query);
            var vtile = options.tile;
            var params = extend({}, options.params);
            var layers = parseLayersInfo(//
            query.layer || query.layers || vtile.names());
            delete query.layers;
            delete query.layer;
            query.layers = [];
            return Promise.all(layers.map(function(layerInfo) {
                if (!layerInfo.fields.length) {
                    layerInfo.fields = //
                    that.extractLayersFields(vtile, layerInfo.layer);
                }
                query.layers.push(layerInfo);
                var opt = extend({}, params, layerInfo, {
                    tile : vtile,
                    format : 'utf'
                });
                return renderer.renderVectorTile(opt)//
                .then(function(grid) {
                    return grid;
                });
            })).then(function(grids) {
                return UtfGridMerge(grids);
            }).then(function(tile) {
                var cb = query.cb;
                var headers;
                if (cb) {
                    var json = JSON.stringify(tile, null, 2);
                    tile = cb + '(' + json + ')';
                    headers = {
                        'Content-Type' : 'application/javascript'
                    };
                } else {
                    headers = {
                        'Content-Type' : 'application/json'
                    };
                }
                return extend({}, options, {
                    params : params,
                    query : query,
                    tile : tile,
                    headers : headers
                });
            });
        });
    },

    extractLayersFields : function(vtile, layer) {
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

});

module.exports = VectorTilesToUtfGrid;