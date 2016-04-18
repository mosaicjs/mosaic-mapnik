function TilesProvider(options) {
    this.initialize(options);
}
TilesProvider.prototype = {
    initialize : function(options) {
        this.options = options || {};
    },
    loadTile : function(options) {
        return Promise.resolve(options || {});
    },

    _getOptionsValue : function(key, options) {
        var value = this.options[key];
        if (typeof value === 'function') {
            value = value.call(this.options, options);
        }
        return value;
    }
}
module.exports = TilesProvider;
