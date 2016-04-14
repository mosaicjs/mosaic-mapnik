var Utils = require('./Utils');
var extend = Utils.extend;
var GeoJsonToPbf = require('./providers/GeoJsonToPbf');
var VectorTilesDeserializer = require('./providers/VectorTilesDeserializer');
var CompositeTilesProvider = require('./providers/CompositeTilesProvider');
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