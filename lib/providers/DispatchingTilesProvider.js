var TilesProvider = require('./TilesProvider');
var Utils = require('../Utils');
var extend = Utils.extend;

function DispatchingTilesProvider(options) {
    this.initialize(options);
}
extend(DispatchingTilesProvider.prototype, TilesProvider.prototype, {

    initialize : function(options) {
        this.options = options || {};
        this.options.providers = this.options.providers || {};
        this._providers = this.options.providers;
        if (typeof this.options.providerKey === 'function') {
            this._getProviderKey = this.options.providerKey;
        }
    },

    loadTile : function(options) {
        var that = this;
        return Promise.resolve().then(function() {
            var key = that._getProviderKey(options);
            var provider = that._providers[key];
            if (!provider) {
                var msg = 'No providers ' + // 
                'were found for the "' + key + '" key.';
                throw new Error(msg);
            }
            return provider.loadTile(options);
        });
    },

    /**
     * Returns the key used to retrieve tiles providers.
     */
    _getProviderKey : function(options) {
        var params = options.params || {};
        var format = params.format || 'png';
        return format;
    },

    add : function(key, provider) {
        this._providers[key] = provider;
        return this;
    }
});
module.exports = DispatchingTilesProvider;
