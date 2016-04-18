var LRU = require('lru-cache');
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
        return LRU({
            max : 15000,
            // 15 minutes
            maxAge : 1000 * 60 * 15
        });
    },

    _getCacheKey : function(options) {
        var cacheId = this._cacheId(options);
        var params = options.params || {};
        var query = JSON.stringify(options.query || {});
        return [ cacheId, params.format, params.z, params.x, params.y, query ]
                .join('|');
    },

    _loadFromCache : function(options) {
        var that = this;
        return Promise.resolve().then(function() {
            var key = that._getCacheKey(options);
            return that._cache.get(key);
        });
    },

    _storeToCache : function(options, result) {
        var that = this;
        return Promise.resolve().then(function() {
            var key = that._getCacheKey(options);
            var value = that._cache.get(key);
            that._cache.set(key, result);
            return value;
        });
    }

});

module.exports = LruCachingTilesProvider;