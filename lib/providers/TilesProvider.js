function TilesProvider(options) {
    this.initialize(options);
}
TilesProvider.prototype = {
    initialize : function(options) {
        this.options = options || {};
    },
    loadTile : function(options) {
        return Promise.resolve(options || {});
    }
}
module.exports = TilesProvider;
