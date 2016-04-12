var TilesProvider = require('./TilesProvider');
var Utils = require('../Utils');
var extend = Utils.extend;

function CompositeTilesProvider(options) {
    this.initialize(options);
}
extend(CompositeTilesProvider.prototype, TilesProvider.prototype, {

    initialize : function(options) {
        this.options = options || {};
        var providers = this.options.providers;
        if (!providers) {
            this._providers = [];
        } else if (Array.isArray(providers)) {
            this._providers = providers;
        } else {
            this._providers = [ providers ];
        }
    },

    loadTile : function(options) {
        var that = this;
        return Promise.resolve().then(function() {
            options = options || {};
            var providers = that._providers;
            var promise = Promise.resolve(options);
            for (var i = 0; i < providers.length; i++) {
                (function(provider) {
                    if (!provider)
                        return;
                    promise = promise.then(function(options) {
                        return provider.loadTile(options);
                    });
                })(providers[i]);
            }
            return promise;
        });
    },

    remove : function(provider) {
        for (var i = this._providers.length - 1; i >= 0; i--) {
            if (this._providers[i] === provider) {
                this._providers.splice(i, 1);
            }
        }
        return this;
    },

    add : function(provider) {
        this._providers.push(provider);
        return this;
    }
});
module.exports = CompositeTilesProvider;
