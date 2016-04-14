var TilesProvider = require('./TilesProvider');
var Utils = require('../Utils');
var extend = Utils.extend;

function MapnikTilesProvider(options) {
    this.initialize(options);
}
extend(MapnikTilesProvider.prototype, TilesProvider.prototype, {

    _loadSourceRenderer : function() {
        try {
            var key = this.options.sourceKey || 'source';
            return this._loadRenderer(key)
        } catch (err) {
            return Promise.reject(err);
        }
    },

    _loadStyleRenderer : function() {
        try {
            var key = this.options.rendererKey || 'style';
            return this._loadRenderer(key)
        } catch (err) {
            return Promise.reject(err);
        }
    },

    /**
     * Returns a MapnikRenderer instance corresponding to the specified key.
     */
    _loadRenderer : function(key) {
        var that = this;
        return Promise.resolve().then(function() {
            var field = '__' + key;
            if (!that[field]) {
                that[field] = that._newRenderer(key);
            }
            return that[field];
        });
    },

    /**
     * Returns a MapnikRenderer instance corresponding to the specified key.
     */
    _newRenderer : function(key) {
        var that = this;
        return Promise.resolve().then(function() {
            if (!that._loader) {
                var loader = that.options.loader;
                if (!loader) {
                    var RendererLoader = require('../RendererLoader');
                    loader = new RendererLoader(that.options);
                }
                that._loader = loader;
            }
            return that._loader.getRenderer(key);
        });
    },

});

module.exports = MapnikTilesProvider;
