var os = require('os');
var path = require('path');
var NodeCache = require('node-cache');
var Pool = require('generic-pool').Pool;
var MapnikConfigLoader = require('../loader/MapnikConfigLoader');
var MapnikRenderer = require('./MapnikRenderer');
var Utils = require('../Utils');
var extend = Utils.extend;
var ninvoke = Utils.ninvoke;
var getOptionsValue = Utils.getOptionsValue;

function MapnikRendererPool() {
    this.initialize.apply(this, arguments);
}

extend(MapnikRendererPool.prototype, {

    _getOptionsValue : getOptionsValue,

    initialize : function(options) {
        this.options = options || {};
        if (!this.options.baseDir) {
            throw new Error('baseDir is not defined');
        }
        var timeToLive = this._getTtl();
        this._cache = new NodeCache({
            stdTTL : timeToLive,
            checkperiod : this._getCheckperiod(),
            useClones : false
        });
        this._cache.on("expired", function(key, poolPromise) {
            poolPromise.then(function(pool) {
                pool.drain(function() {
                    pool.destroyAllNow();
                });
            });
        });
    },

    _getTtl : function(key) {
        var result;
        if (key === 'source') {
            result = this._getOptionsValue('ttlSource');
        } else if (key === 'style') {
            result = this._getOptionsValue('ttlStyle');
        }
        if (!result) {
            result = this._getOptionsValue('ttl');
        }
        return result || 0; // infinite store
    },

    _getCheckperiod : function() {
        return this._getOptionsValue('checkperiod') || this._getTtl() * 1.1;
    },

    _getMaxRendererNumber : function() {
        return this.options.renderesNumber || os.cpus().length;
    },

    getBaseDir : function() {
        return this._getOptionsValue('baseDir');
    },

    withRenderer : function(key, action, options) {
        var that = this;
        return that._getRendererPool(key, options).then(function(pool) {
            return ninvoke(pool, 'acquire').then(function(renderer) {
                return Promise.resolve().then(function() {
                    return action(renderer);
                }).then(function(result) {
                    pool.release(renderer);
                    return result;
                }, function(err) {
                    pool.release(renderer);
                    throw err;
                });
            });
        });
    },

    _getRendererPool : function(key, options) {
        var that = this;
        return Promise.resolve().then(function() {
            var poolPromise = that._cache.get(key);
            if (!poolPromise) {
                poolPromise = that._newRendererPool(key, options);
            }
            // Force to re-fresh expiration time
            var ttl = that._getTtl(key);
            that._cache.set(key, poolPromise, ttl);
            return poolPromise;
        });
    },

    _newRendererPool : function(key, options) {
        var that = this;
        return that._readProjectConfig(key, options).then(function(config) {
            return new Pool({
                name : key,
                create : function(callback) {
                    try {
                        var renderer = //
                        that._newMapnikRenderer(config, options);
                        callback(null, renderer);
                    } catch (err) {
                        callback(err);
                    }
                },
                destroy : function(renderer) {
                    // renderer.close();
                },
                max : that._getMaxRendererNumber(),
                idleTimeoutMillis : that._getTtl()
            });
        })
    },

    _readProjectConfig : function(key, options) {
        var that = this;
        return Promise.resolve().then(function() {
            var baseDir = that.getBaseDir();
            if (!that._configLoader) {
                var opt = extend({}, that.options, //
                options, {
                    key : key,
                    baseDir : baseDir
                });
                that._configLoader = new MapnikConfigLoader(opt);
            }
            return that._configLoader.readProject({
                dir : path.resolve(baseDir, key)
            });
        });
    },

    _newMapnikRenderer : function(config, options) {
        config = extend({}, this.options, options, config);
        var renderer = new MapnikRenderer(config);
        return renderer;
    }

});

module.exports = MapnikRendererPool;
