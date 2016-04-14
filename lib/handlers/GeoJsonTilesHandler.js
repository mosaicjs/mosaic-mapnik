var Utils = require('../Utils');
var extend = Utils.extend;
var GeoJsonToPbf = require('../tiles/GeoJsonToPbf');
var VectorTilesDeserializer = require('../tiles/VectorTilesDeserializer');
var CompositeTilesProvider = require('../tiles/CompositeTilesProvider');
var TilesHandler = require('./TilesHandler');

function GeoJsonTilesHandler(options) {
    this.initialize(options);
}
extend(GeoJsonTilesHandler.prototype, TilesHandler.prototype, {

    _newVectorTilesProvider : function() {
        return new CompositeTilesProvider([ //
        new GeoJsonToPbf(this.options), //
        new VectorTilesDeserializer(this.options) //
        ]);
    },

});

module.exports = GeoJsonTilesHandler;