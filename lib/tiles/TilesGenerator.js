var CompositeTilesProvider = require('./CompositeTilesProvider');
var GeoJsonToPbf = require('./GeoJsonToPbf');
var LruCachingTilesProvider = require('./cache/LruCachingTilesProvider');
var MbtilesCachingTilesProvider = require('./cache/MbtilesCachingTilesProvider');
var TilesEncoder = require('./TilesEncoder');
var TilesProvider = require('./TilesProvider');
var VectorTilesDeserializer = require('./VectorTilesDeserializer');
var VectorTilesGenerator = require('./VectorTilesGenerator');
var VectorTilesRenderer = require('./VectorTilesRenderer');
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

    _newTilesProvider : function() {
        var options = this.options;

        var source = this._newVectorTilesProvider(options);
        var renderer = new VectorTilesRenderer(extend({}, options, {
            ttl : options.ttlStyle || options.ttl
        }));
        var provider = new CompositeTilesProvider([ source, renderer ]);

        // Use the cache to retrieve tiles
        provider = this._newCachingProvider(options, provider);
        
        // Encode resulting tiles
        var encoder = new TilesEncoder(options);
        provider = new CompositeTilesProvider([ provider, encoder ]);
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
        if (options.noTilesCache)
            return provider;
        var cacheDir = options.cacheDir || options.mbtiles;
        var cacheOptions = extend({}, options, {
            provider : provider
        });
        if (cacheDir) {
            return new MbtilesCachingTilesProvider(cacheOptions);
        } else {
            return new LruCachingTilesProvider(cacheOptions);
        }
    },

});

module.exports = TilesGenerator;
