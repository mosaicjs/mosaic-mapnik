var TilesProvider = require('./TilesProvider');
var Utils = require('../Utils');
var extend = Utils.extend;

/**
 * Serializes provided mapnik.VectorTile instance as a buffer. Expects a
 * mapnik.VectorTile instance in the options.tile. Returns a buffer-serialized
 * version of the tile.
 * 
 * @param options
 */
function VectorTilesSerializer(options) {
    this.initialize(options);
}
extend(VectorTilesSerializer.prototype, TilesProvider.prototype, {
    loadTile : function(options) {
        var that = this;
        return Promise.resolve().then(function() {
            var buffer = options.vtile.getData();
            return {
                tile : buffer,
                headers : {
                    'Content-Type' : 'application/x-protobuf'
                }
            };
        });
    }
});

module.exports = VectorTilesSerializer;