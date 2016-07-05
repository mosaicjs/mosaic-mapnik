var DispatchingTilesProvider = require('./DispatchingTilesProvider');
var MapnikRendererPool = require('../renderer/MapnikRendererPool');
var TilesProvider = require('./TilesProvider');
var VectorTilesToImage = require('./VectorTilesToImage');
var VectorTilesToUtfGrid = require('./VectorTilesToUtfGrid');
var VectorTilesSerializer = require('./VectorTilesSerializer');
var VectorTilesToGeoJson = require('./VectorTilesToGeoJson');
var Utils = require('../Utils');
var extend = Utils.extend;

function VectorTilesRenderer(options) {
    this.initialize(options);
}
extend(VectorTilesRenderer.prototype, TilesProvider.prototype, {

    initialize : function(options) {
        this.options = options || {};
        this._provider = this._newTilesProvider();
    },

    loadTile : function(options) {
        return this._provider.loadTile(options);
    },

    _getRendererPool : function() {
        if (!this._rendererPool) {
            this._rendererPool = this.options.pool
                    || new MapnikRendererPool(this.options)
        }
        return this._rendererPool;
    },

    _newTilesProvider : function() {
        var options = extend({}, this.options, {
            pool : this._getRendererPool()
        });
        var imageGenerator = new VectorTilesToImage(options);
        var utfGridGenerator = new VectorTilesToUtfGrid(options);
        var jsonGenerator = new VectorTilesToGeoJson(options);
        var provider = new DispatchingTilesProvider({
            'pbf' : new VectorTilesSerializer(options),
            'png' : imageGenerator,
            'utf.json' : utfGridGenerator,
            'utf.jsonp' : utfGridGenerator,
            'json' : jsonGenerator,
            'jsonp' : jsonGenerator
        });
        return provider;
    },

});

module.exports = VectorTilesRenderer;
