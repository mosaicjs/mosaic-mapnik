var TilesProvider = require('./TilesProvider');
var Utils = require('../Utils');
var GeoJsonUtils = require('../GeoJsonUtils');
var parseLayersInfo = require('./parseLayersInfo');
var extend = Utils.extend;
var ninvoke = Utils.ninvoke;

/**
 * Serializes provided mapnik.VectorTile instance as a JSON object. Expects a
 * mapnik.VectorTile instance in the options.tile. Returns a JSON object.
 * 
 * @param options
 */
function VectorTilesToGeoJson(options) {
    this.initialize(options);
}

extend(VectorTilesToGeoJson.prototype, TilesProvider.prototype, {
    loadTile : function(options) {
        var that = this;
        return Promise.resolve().then(function() {
            var query = extend({}, options.query);
            var vtile = options.tile;
            var params = extend({}, options.params);
            var layers = parseLayersInfo(//
            query.layer || query.layers || vtile.names());
            delete query.layers;
            delete query.layer;
            query.layers = [];
            return Promise.all(layers.map(function(layerInfo) {
                query.layers.push(layerInfo);
                var opt = extend({}, params, layerInfo, {
                    tile : vtile,
                    format : 'utf'
                });
                return ninvoke(vtile, 'toGeoJSON', layerInfo.layer)//
                .then(function(str) {
                    var json = JSON.parse(str);
                    if (layerInfo.fields.length) {
                        var names = {};
                        layerInfo.fields.forEach(function(name) {
                            names[name] = true;
                        });
                        json.features = json.features.map(function(f) {
                            var properties = {};
                            Object.keys(f.properties).forEach(function(name) {
                                if (name in names) {
                                    properties[name] = f.properties[name];
                                }
                            })
                            f.properties = properties;
                            return f;
                        });
                    }
                    return json;
                });
            })).then(function(grids) {
                return GeoJsonUtils.merge(grids);
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

module.exports = VectorTilesToGeoJson;