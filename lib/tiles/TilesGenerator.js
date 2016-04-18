var mapnik = require('mapnik');
var CompositeTilesProvider = require('./CompositeTilesProvider');
var GeoJsonToPbf = require('./GeoJsonToPbf');
var DispatchingTilesProvider = require('./DispatchingTilesProvider');
var LruCachingTilesProvider = require('./cache/LruCachingTilesProvider');
var MapnikRendererPool = require('../renderer/MapnikRendererPool');
var MbtilesCachingTilesProvider = require('./cache/MbtilesCachingTilesProvider');
var TilesEncoder = require('./TilesEncoder');
var TilesProvider = require('./TilesProvider');
var VectorTilesDeserializer = require('./VectorTilesDeserializer');
var VectorTilesGenerator = require('./VectorTilesGenerator');
var VectorTilesToImage = require('./VectorTilesToImage');
var VectorTilesToUtfGrid = require('./VectorTilesToUtfGrid');
var VectorTilesSerializer = require('./VectorTilesSerializer');
var VectorTilesToGeoJson = require('./VectorTilesToGeoJson');
var Utils = require('../Utils');
var extend = Utils.extend;

function TilesGenerator(options) {
    this.initialize(options);
}
extend(TilesGenerator.prototype, TilesProvider.prototype, {

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
        var provider = new CompositeTilesProvider([ //
        this._newVectorTilesProvider(options), //
        new DispatchingTilesProvider({
            'pbf' : new VectorTilesSerializer(options),
            'png' : imageGenerator,
            'utf.json' : utfGridGenerator,
            'utf.jsonp' : utfGridGenerator,
            'json' : jsonGenerator,
            'jsonp' : jsonGenerator
        }) ]);
        // Use the cache to retrieve tiles
        provider = this._newCachingProvider(options, provider);
        // Encode resulting tiles
        provider = new CompositeTilesProvider([ //
        provider, new TilesEncoder(options) ]);
        return provider;
    },

    _newVectorTilesProvider : function(options) {
        if (options.provider)
            return options.provider;
        if (options.data || options.files) {
            return new CompositeTilesProvider([ //
            new GeoJsonToPbf(options), //
            new VectorTilesDeserializer(options) //
            ]);
        } else {
            return new VectorTilesGenerator(options);
        }
    },

    _newCachingProvider : function(options, provider) {
        var cacheDir = options.cacheDir || options.mbtiles;
        if (cacheDir) {
            return new MbtilesCachingTilesProvider(extend({}, options, {
                provider : provider
            }));
        } else {
            return new LruCachingTilesProvider(provider);
        }
    },

});

module.exports = TilesGenerator;
