var TilesProvider = require('./TilesProvider');
var Utils = require('../Utils');
var extend = Utils.extend;

function MapnikTilesProvider(options) {
    this.initialize(options);
}
extend(MapnikTilesProvider.prototype, TilesProvider.prototype, {

    _withSourceRenderer : function(action) {
        return this._withRenderer(this.options.sourceKey || 'source', action);
    },

    _withStyleRenderer : function(action) {
        return this._withRenderer(this.options.rendererKey || 'style', action);
    },

    /**
     * Executes the specified action with a MapnikRenderer instance
     * corresponding to the specified key.
     */
    _withRenderer : function(key, action) {
        var that = this;
        return Promise.resolve().then(function() {
            var pool = that._getRendererPool();
            return pool.withRenderer(key, function(renderer) {
                return action.call(that, renderer);
            });
        });
    },

    /**
     * Returns a MapnikRendererPool instance used as a source of MapnikRenderer
     * instances.
     */
    _getRendererPool : function(key) {
        if (!this._pool) {
            this._pool = this.options.pool || this.options.loader;
            if (!this._pool) {
                var MapnikRendererPool = require('../renderer/MapnikRendererPool');
                this._pool = new MapnikRendererPool(this.options);
            }
        }
        return this._pool;
    },

});

module.exports = MapnikTilesProvider;
