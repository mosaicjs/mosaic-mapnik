var path = require('path');
var NodeCache = require('node-cache');
var MapnikConfigLoader = require('./MapnikConfigLoader');
var MapnikRenderer = require('./MapnikRenderer');
var Utils = require('./Utils');
var extend = Utils.extend;
var ninvoke = Utils.ninvoke;

function RendererLoader() {
    this.initialize.apply(this, arguments);
}

extend(RendererLoader.prototype, {

    initialize : function(options) {
        this.options = options || {};
        if (!this.options.baseDir) {
            throw new Error('baseDir is not defined');
        }
        var ttl = this.options.ttl || 15 * 60; // 15 mins
        this._cache = new NodeCache({
            stdTTL : ttl,
            checkperiod : ttl * 1.1,
            useClones : false
        });
    },

    getBaseDir : function() {
        return this.options.baseDir;
    },

    getRenderer : function(key) {
        var that = this;
        return ninvoke(that._cache, 'get', key).then(function(renderer) {
            return renderer || that.loadRenderer(key).then(function(renderer) {
                return ninvoke(that._cache, 'set', key, renderer)// 
                .then(function() {
                    return renderer;
                });
            });
        })
    },

    loadRenderer : function(key) {
        var that = this;
        return Promise.resolve().then(function() {
            var baseDir = that.getBaseDir();
            var loader = new MapnikConfigLoader({
                baseDir : baseDir
            });
            return loader.readProject({
                dir : path.resolve(baseDir, key)
            }).then(function(params) {
                var renderer = new MapnikRenderer(extend({}, that.options, {
                    xml : params.xml
                }));
                return renderer;
            });
        });
    },

});

module.exports = RendererLoader;
