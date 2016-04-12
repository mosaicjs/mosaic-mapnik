var TilesProvider = require('./TilesProvider');
var Utils = require('../Utils');
var extend = Utils.extend;

function DispatchingTilesProvider(options) {
    this.initialize(options);
}
extend(DispatchingTilesProvider.prototype, TilesProvider.prototype, {

    initialize : function(options) {
        this.options = options || {};
        this._providers = this.options.providers = //
        this.options.providers || {};
    },

    loadTile : function(options) {
        var that = this;
        return Promise.resolve().then(function() {
            var params = options.params || {};
            var format = params.format || 'png';
            var provider = that._providers[format];
            if (!provider) {
                var msg = 'No providers ' + // 
                'were found for the "' + format + '" format.';
                throw new Error(msg);
            }
            return provider.loadTile(options);
        });
    },

    add : function(format, provider) {
        this._providers[format] = provider;
        return this;
    }
});
module.exports = DispatchingTilesProvider;
