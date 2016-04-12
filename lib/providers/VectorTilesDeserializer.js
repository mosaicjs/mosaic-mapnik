var TilesProvider = require('./TilesProvider');
var mapnik = require('mapnik');
var Utils = require('../Utils');
var extend = Utils.extend;
var ninvoke = Utils.ninvoke;
/**
 * Transforms the specified Buffer tile to a mapnik.VectorTile instance used to
 * rendering.
 * 
 * @param options
 */
function VectorTilesDeserializer(options) {
    this.initialize(options);
}
extend(VectorTilesDeserializer.prototype, TilesProvider.prototype, {
    loadTile : function(options) {
        var that = this;
        return Promise.resolve().then(function() {
            var params = options.params;
            var z = +params.z;
            var x = +params.x;
            var y = +params.y;
            var vtile = new mapnik.VectorTile(z, x, y, params);
            var result = extend({}, options, {
                tile : vtile,
                headers : {
                    'Content-Type' : 'application/x-mapnik-vector-tile'
                }
            });
            var data = options.tile;
            if (!data.length)
                return result;
            return ninvoke(vtile, vtile.setData, data)//
            .then(function() {
                return ninvoke(vtile, vtile.parse);
            }).then(function() {
                return result;
            });
        });
    }
});

module.exports = VectorTilesDeserializer;
