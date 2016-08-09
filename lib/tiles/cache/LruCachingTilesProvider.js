var NodeCache = require('node-cache');
var CachingTilesProvider = require('./CachingTilesProvider');
var Utils = require('../../Utils');
var extend = Utils.extend;

function LruCachingTilesProvider(options) {
    this.initialize(options);
}
extend(LruCachingTilesProvider.prototype, CachingTilesProvider.prototype, {
    initialize : function(options) {
        CachingTilesProvider.prototype.initialize.apply(this, arguments);
        this._cache = this._newCache();
    },

    clearCache : function(options) {
        this._cache = this._newCache();
    },

    _newCache : function() {
        var ttl = this.options.ttl || 1000 * 60 * 15 // 15 minutes;
        var cache = new NodeCache({
            stdTTL : ttl,
            checkperiod : ttl * 1.2,
            useClones : false
        });
        cache.on("expired", function(key, tile) {
        });
        return cache;
    },

    _getTileCacheKey : function(options) {
        var params = options.params || {};
        var query = JSON.stringify(options.query || {});
        var cacheId = options.cacheId || '';
        return [ cacheId, params.format, params.z, params.x, params.y, query ]
                .join('|');
    },

    _loadFromCache : function(options) {
        var that = this;
        return Promise.resolve().then(function() {
            var key = that._getTileCacheKey(options);
            return key ? that._cache.get(key) : undefined;
        });
    },

    _storeToCache : function(options, result) {
        var that = this;
        return Promise.resolve().then(function() {
            var key = that._getTileCacheKey(options);
            if (key) {
                that._cache.set(key, result);
            }
            return result;
        });
    }

});

module.exports = LruCachingTilesProvider;