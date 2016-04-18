var TilesProvider = require('./TilesProvider');
var Utils = require('../Utils');
var extend = Utils.extend;
var ninvoke = Utils.ninvoke;

/**
 * Encodes tiles to send them to the client.
 * 
 * @param options
 */
function TilesEncoder(options) {
    this.initialize(options);
}
extend(TilesEncoder.prototype, TilesProvider.prototype, {
    loadTile : function(options) {
        var that = this;
        return Promise.resolve().then(function() {
            var params = options.params;
            var tile = options.tile;
            var headers = options.headers;
            var query = extend({}, options.query);
            var cb = query.cb;
            if (cb && headers['Content-Type'] === 'application/json') {
                var json;
                if (tile instanceof Buffer) {
                    json = tile.toString('UTF-8');
                } else {
                    json = JSON.stringify(tile, null, 2);
                }
                tile = cb + '(' + json + ')';
                headers['Content-Type'] = 'application/javascript';
            } 
            if (!(tile instanceof Buffer) && (typeof tile === 'object')) {
                tile = JSON.stringify(tile, null, 2);
            }
            return extend({}, options, {
                tile : tile,
                headers : headers
            })
        });
    }
});

module.exports = TilesEncoder;
