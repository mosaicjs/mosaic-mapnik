var os = require('os');
var path = require('path');
var NodeCache = require('node-cache');
var Pool = require('generic-pool').Pool;
var MapnikConfigLoader = require('../loader/MapnikConfigLoader');
var MapnikRenderer = require('./MapnikRenderer');
var Utils = require('../Utils');
var extend = Utils.extend;
var ninvoke = Utils.ninvoke;

function MapnikRendererPool() {
    this.initialize.apply(this, arguments);
}

extend(MapnikRendererPool.prototype, {

    initialize : function(options) {
        this.options = options || {};
        if (!this.options.baseDir) {
            throw new Error('baseDir is not defined');
        }
        this._cache = new NodeCache({
            stdTTL : this._getTtl(),
            checkperiod : this._getCheckperiod(),
            useClones : false
        });
        this._cache.on("expired", function(key, poolPromise) {
            poolPromise.then(function(pool){
                pool.drain(function() {
                    pool.destroyAllNow();
                });
            });
        });
    },

    _getTtl : function() {
        return this.options.ttl || 15 * 60; // 15 mins
    },

    _getCheckperiod : function() {
        return this._getTtl() * 1.1;
    },

    _getMaxRendererNumber : function() {
        return this.options.renderesNumber || os.cpus().length;
    },

    getBaseDir : function() {
        return this.options.baseDir;
    },

    withRenderer : function(key, action) {
        var that = this;
        return that._getRendererPool(key).then(function(pool) {
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

    _getRendererPool : function(key) {
        var that = this;
        return Promise.resolve().then(function() {
            var poolPromise = that._cache.get(key);
            if (!poolPromise) {
                poolPromise = that._newRendererPool(key);
            }
            // Force to re-fresh expiration time 
            that._cache.set(key, poolPromise);
            return poolPromise;
        });
    },

    _newRendererPool : function(key) {
        var that = this;
        return that._readProjectConfig(key).then(function(config) {
            return new Pool({
                name : key,
                create : function(callback) {
                    try {
                        var renderer = that._newMapnikRenderer(config);
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

    _readProjectConfig : function(key) {
        var that = this;
        return Promise.resolve().then(function() {
            var baseDir = that.getBaseDir();
            if (!that._configLoader) {
                that._configLoader = new MapnikConfigLoader({
                    baseDir : baseDir
                });
            }
            return that._configLoader.readProject({
                dir : path.resolve(baseDir, key)
            });
        });
    },

    _newMapnikRenderer : function(params) {
        var renderer = new MapnikRenderer(extend({}, this.options, {
            xml : params.xml
        }));
        return renderer;
    }

});

module.exports = MapnikRendererPool;
