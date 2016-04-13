var TilesProvider = require('./TilesProvider');
var mapnik = require('../initMapnik');
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
            var vtileParams = this.options.vtileParams || {
                buffer_size : 64,
                bufferSize : 64,
                tileSize : 4096
            };
            var vtile = new mapnik.VectorTile(z, x, y, vtileParams);
            var result = extend({}, options, {
                tile : vtile,
                headers : {
                    'Content-Type' : 'application/x-mapnik-vector-tile'
                }
            });
            if (!options.tile.length)
                return result;
            return ninvoke(vtile, vtile.setData, options.tile) //
            .then(function() {
                return result;
            });
        });
    }
});

module.exports = VectorTilesDeserializer;
