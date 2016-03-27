var path = require('path');
var NodeCache = require('node-cache');
var MapnikConfigLoader = require('./MapnikConfigLoader');
var MapnikRenderer = require('./MapnikRenderer');

function RendererLoader() {
    this.initialize.apply(this, arguments);
}

RendererLoader.prototype = {

    initialize : function(options) {
        this.options = options || {};
        if (!this.options.baseDir) {
            throw new Error('baseDir is not defined');
        }
        var ttl = this.options.ttl || 15 * 60; // 15 mins
        this._cache = new NodeCache({
            stdTTL : ttl,
            checkperiod : ttl * 1.1
        });
    },

    getBaseDir : function() {
        return this.options.baseDir;
    },

    getRenderer : function(key) {
        var that = this;
        return that._callCache('get', key).then(function(renderer) {
            return renderer //
            ? renderer //
            : that.loadRenderer(key).then(function(renderer) {
                return that._callCache('set', key, renderer)// 
                .then(function() {
                    return renderer;
                });
            });
        })
    },

    loadRenderer : function(key) {
        var baseDir = this.getBaseDir();
        var loader = new MapnikConfigLoader({
            baseDir : baseDir
        });
        return loader.readProject({
            dir : path.resolve(baseDir, key)
        }).then(function(params) {
            var renderer = new MapnikRenderer({
                xml : params.xml,
                tileSize : 256
            });
            return renderer;
        });
    },

    _callCache : function() {
        var args = [ this._cache ];
        for (var i = 0; i < arguments.length; i++) {
            args.push(arguments[i]);
        }
        return this._ninvoke.apply(this, args);
    },

    _ninvoke : function(obj, f) {
        var args = [];
        for (var i = 2; i < arguments.length; i++) {
            args.push(arguments[i]);
        }
        return new Promise(function(resolve, reject) {
            args.push(function(err, result) {
                if (err)
                    return reject(err);
                else
                    return resolve(result);
            });
            if (typeof f === 'string') {
                f = obj[f];
            }
            try {
                return f.apply(obj, args);
            } catch (err) {
                return reject(err);
            }
        });
    },
}

module.exports = RendererLoader;
