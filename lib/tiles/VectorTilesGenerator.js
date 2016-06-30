var TilesProvider = require('./TilesProvider');
var Utils = require('../Utils');
var extend = Utils.extend;
var MapnikTilesProvider = require('./MapnikTilesProvider');

function VectorTilesGenerator(options) {
    this.initialize(options);
}
extend(VectorTilesGenerator.prototype, MapnikTilesProvider.prototype, {
    loadTile : function(options) {
        var that = this;
        return that._withSourceRenderer(function(source) {
            return source.buildVectorTile(options.params).then(function(info) {
                return extend({}, options, {
                    tile : info.vtile,
                    headers : {
                        'Content-Type' : 'application/x-mapnik-vector-tile'
                    }
                });
            });
        }, options);
    }
});

module.exports = VectorTilesGenerator;