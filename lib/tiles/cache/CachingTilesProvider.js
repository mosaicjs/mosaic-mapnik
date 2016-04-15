var TilesProvider = require('../TilesProvider');
var Utils = require('../../Utils');
var extend = Utils.extend;

function CachingTilesProvider(options) {
    this.initialize(options);
}
extend(CachingTilesProvider.prototype, TilesProvider.prototype, {

    initialize : function(options) {
        this.options = options || {};
        if (typeof options.loadTile === 'function') {
            this.options = {
                provider : options
            }
        }
        if (!this.options.provider) {
            throw new Error('Provider is not defined');
        }
    },

    loadTile : function(options) {
        var that = this;
        return Promise.resolve().then(function() {
            return that._loadFromCache(options).then(function(result) {
                return result || that.options.provider.loadTile(options)//
                .then(function(result) {
                    return that._storeToCache(options, result)//
                    .then(function() {
                        return result;
                    });
                });
            });
        }).then(null, function(err) {
            console.log('[ERROR]', err, err.stack);
            throw err;
        });
    },

    // ---------------------------------------------------------------------
    // Methods to re-define in subclasses.

    clearCache : function(options) {
    },

    _loadFromCache : function(options) {
        return Promise.resolve();
    },

    _storeToCache : function(options, result) {
        return Promise.resolve();
    }

});
module.exports = CachingTilesProvider;
