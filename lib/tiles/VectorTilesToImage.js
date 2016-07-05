var MapnikTilesProvider = require('./MapnikTilesProvider');
var Utils = require('../Utils');
var extend = Utils.extend;

/**
 * Renders the specified mapnik.VectorTile instance to an image. Returns a
 * buffer-serialized image in the requested format (PNG, SVG, PDF...).
 * 
 * @param options
 */
function VectorTilesToImage(options) {
    this.initialize(options);
}

extend(VectorTilesToImage.prototype, MapnikTilesProvider.prototype, {
    loadTile : function(options) {
        var that = this;
        return that._withStyleRenderer(function(renderer) {
            var params = extend({}, options.params, {
                vtile : options.tile,
                format : 'png'
            });
            return renderer.renderVectorTile(params).then(function(image) {
                return extend({}, options, {
                    tile : image,
                    headers : {
                        'Content-Type' : 'image/png'
                    }
                });
            });
        }, options);
    }
});

module.exports = VectorTilesToImage;