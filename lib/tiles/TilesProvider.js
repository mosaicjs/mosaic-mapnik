var Utils = require('../Utils');
var getOptionsValue = Utils.getOptionsValue;

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
    _getOptionsValue : getOptionsValue,
}
module.exports = TilesProvider;
