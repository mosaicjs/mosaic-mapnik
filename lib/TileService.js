var Mosaic = require('mosaic-commons');
var MapnikConfigLoader = require('./MapnikConfigLoader');
var MapnikRenderer = require('./MapnikRenderer');
var Path = require('path');
var FS = require('fs');
var LRU = require('lru-cache');
var _ = require('underscore');

var Cache = Mosaic.Class.extend({
    initialize : function(options) {
        this.setOptions(options);
        var timeout = this._getCacheTimeout();
        this._cache = new LRU({
            dispose : function(key, n) {
            },
            maxAge : timeout
        });
        if (this.options.getCacheHandler) {
            this.getCacheHandler = this.options.getCacheHandler;
        }
    },
    _getCacheTimeout : function() {
        return this.options.timeout || 10 * 60 * 1000 /* 10 min */;
    },
    getCacheHandler : function() {
        throw new Error('Cache handler should be defined in subclasses.');
    },
    _withHandler : function(params, action) {
        var that = this;
        return Mosaic.P.then(function() {
            return that.getCacheHandler(params);
        }).then(function(handler) {
            return Mosaic.P.then(function() {
                return action(handler);
            }).then(function(result) {
                handler.close(params);
                return result;
            }, function(err) {
                handler.close(params);
                throw err;
            });
        });
    },
    load : function(key, params) {
        var that = this;
        var promise = that._cache.get(key);
        if (!promise) {
            promise = that._withHandler(params, function(handler) {
                var tmpDir = that.options.tmpDir;
                var array = tmpDir.split('/');

                var segments = key.split(':');
                var fileName = segments.pop();
                array = array.concat(segments);
                tmpDir = that._mkdir(array);
                console.log(' ** ', tmpDir, segments);

                var file = Path.join(tmpDir, fileName);
                var promise;
                if (FS.existsSync(file)) {
                    // Load an already existing object from the file
                    promise = Mosaic.P.ninvoke(FS, FS.readFile, file)//
                    .then(function(data) {
                        return handler.deserialize(data, params);
                    });
                } else {
                    // Builds a new object and store it in a file
                    var object;
                    promise = Mosaic.P.then(function() {
                        return handler.create(params);
                    }).then(function(obj) {
                        object = obj;
                        return handler.serialize(object, params);
                    }).then(function(data) {
                        return Mosaic.P.ninvoke(FS, FS.writeFile, file, data);
                    }).then(function() {
                        return object;
                    });
                }
                return promise;
            });
            that._cache.set(key, promise);
        }
        return promise;
    },
    _mkdir : function mkdir(array) {
        var dir = array.join('/');
        if (!FS.existsSync(dir)) {
            mkdir(array.splice(0, array.length - 1));
            FS.mkdirSync(dir);
        }
        return dir;
    }
});
Cache.Handler = Mosaic.Class.extend({
    initialize : function(options) {
        this.setOptions(options);
        _.extend(this, options);
    },
    serialize : function(object, options) {
        return object;
    },
    deserialize : function(data, options) {
        return data;
    },
    create : function(options) {
        return;
    },
    destroy : function(object, options) {
    },
    close : function() {
    }
});
;

var TileService = Mosaic.Class.extend({

    initialize : function(options) {
        this.setOptions(options);
        var that = this;
        this._tilesCache = that._newTileCache({
            getCacheHandler : function() {
                return new Cache.Handler({
                    create : function(options) {
                        var key = that._getCacheKey('vtile', options);
                        return that._vectorCache.load(key, options)//
                        .then(function(vector) {
                            return that._loadRenderer(options.sourceKey)//
                            .then(function(renderer) {
                                options = that._extendParams(options, //
                                renderer);
                                return renderer.exec(function(r) {
                                    return r.renderVectorTile(vector);
                                })
                            });
                        });
                    }
                });
            }
        });
        this._vectorCache = that._newTileCache({
            getCacheHandler : function(options) {
                return that._loadRenderer(options.sourceKey)//
                .then(function(renderer) {
                    options = that._extendParams(options, renderer);
                    return new Cache.Handler({
                        serialize : function(object, options) {
                            var vtile = object.vtile;
                            return vtile.getData();
                        },
                        deserialize : function(data, options) {
                            return renderer.exec(function(r) {
                                return r.loadVectorTile(data, options);
                            });
                        },
                        create : function(options) {
                            return renderer.exec(function(r) {
                                return r.buildVectorTile(options);
                            });
                        }
                    });
                });
            }
        });
    },

    _newTileCache : function(options) {
        var tmpDir = this._getTmpDir();
        return new Cache(_.extend({
            tmpDir : tmpDir,
        }, options));
    },

    tile : rest('/*source/:z/:x/:y/tile.:format', 'GET', function(options) {
        var that = this;
        options = options || {};
        var params = this._getParams(options);
        var key = that._getCacheKey(params.format, params);
        return that._tilesCache.load(key, params);
    }),

    _getParams : function(options) {
        var sourceKey = options.source;
        var format = options.format || 'png';
        if (format == 'grid.json') {
            format = 'utf';
        }
        var zoom = +options.z;
        var x = +options.x;
        var y = +options.y;
        return {
            sourceKey : sourceKey,
            format : format,
            z : zoom,
            x : x,
            y : y
        };
    },

    _extendParams : function(options, renderer) {
        var newOptions = _.extend({}, options);
        var config = renderer.options.config;
        var interactivity = config.interactivity || {};
        interactivity.fields = '' + (interactivity.fields || '');
        interactivity.fields = //
        _.isString(interactivity.fields) ? //
        interactivity.fields.split(',') : //
        _.toArray(interactivity.fields);
        newOptions.buffer_size = renderer.options.buffer_size ||
                config.buffer_size || options.buffer_size || //
                that.options.buffer_size || 128;
        _.extend(newOptions, interactivity);
        return newOptions;
    },

    _getCacheKey : function(format, params) {
        var key = 'tile-' + params.z + '-' + params.x + '-' + params.y;
        key = params.sourceKey + ':' + format + ':' + key + '.' + format;
        return key;
    },

    _loadRenderer : function(sourceKey) {
        var that = this;
        if (!that._renderers) {
            var timeout = this.options.rendererTimeout || 10 * 60 * 1000;
            this._renderers = new LRU({
                dispose : function(key, renderer) {
                    renderer.close();
                },
                maxAge : timeout
            });
        }
        return Mosaic.P.then(function() {
            var promise = that._renderers.get(sourceKey);
            if (!promise) {
                promise = that._newRenderer(sourceKey);
                that._renderers.set(sourceKey, promise);
            }
            return promise;
        });
    },

    _newRenderer : function(sourceKey) {
        var that = this;
        var projectDir = that._getProjectDir(sourceKey);
        var mml = that._loadProjectFile(projectDir, sourceKey);
        var loader = that._getMapnikConfigLoader(sourceKey);
        return loader.loadMssFromMml(projectDir, mml).then(function(options) {
            options.tmpDir = that._getTmpDir();
            options.sourceId = that._getSourceId(options, sourceKey);
            options.base = projectDir;
            options.tileSize = options.tileSize || 256;
            var renderer = new MapnikRenderer(options);
            return renderer;
        });
    },

    _getMapnikConfigLoader : function() {
        if (!this._mapnikConfigLoader) {
            var tmpDir = this._getTmpDir();
            this._mapnikConfigLoader = new MapnikConfigLoader({
                // Used by millstone to download externaal data sources
                tmpDir : tmpDir
            });
        }
        return this._mapnikConfigLoader;
    },

    _getTmpDir : function(options) {
        var dir = this.options.tmpDir || Path.resolve(__dirname, './tmp');
        return dir;
    },

    _loadProjectFile : function(projectDir, sourceKey) {
        var path, mml;
        if (!this.options.disableScripts) {
            path = Path.resolve(projectDir, 'project.js');
            if (FS.existsSync(path)) {
                delete require.cache[path];
                var script = require(path);
                if (_.isFunction(script)) {
                    mml = script();
                } else {
                    mml = script;
                }
            }
        }
        if (!mml) {
            path = Path.resolve(projectDir, 'project.mml');
            mml = JSON.parse(FS.readFileSync(path));
        }
        return mml;
    },

    _getProjectDir : function(sourceKey) {
        var currentDir = this.options.dir || __dirname;
        return Path.resolve(currentDir, sourceKey);
    },

    _getSourceId : function(options, sourceKey) {
        return options.id || options.sourceId || sourceKey || 'unknown';
    }

});

module.exports = TileService;

/**
 * This utility function "annotates" the specified object methods by the
 * corresponding REST paths and HTTP methods.
 */
function rest(path, http, method) {
    method.http = http.toLowerCase();
    method.path = path;
    return method;
}
