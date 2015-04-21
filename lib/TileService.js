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
    load : function(key, params) {
        var that = this;
        var promise = that._cache.get(key);
        if (!promise) {
            promise = that._withHandler(key, params, this._doLoad);
            that._cache.set(key, promise);
        }
        return promise;
    },
    _withHandler : function(key, params, action) {
        var that = this;
        return Mosaic.P.then(function() {
            return that.getCacheHandler(params);
        }).then(function(handler) {
            return Mosaic.P.then(function() {
                return action.call(that, handler, key, params);
            }).then(function(result) {
                handler.close(params);
                return result;
            }, function(err) {
                handler.close(params);
                throw err;
            });
        });
    },

    // -------------------------------------------------------
    // To overload in subclasses.

    _doLoad : function(handler, key, params) {
        var tmpDir = this.options.tmpDir;
        var array = tmpDir.split('/');

        var segments = key.split(':');
        var fileName = segments.pop();
        _.each(segments, function(segment) {
            var s = segment.split('/');
            array = array.concat(s);
        });
        // array = _.filter(array, function(segment) {
        // return segment && segment !== '';
        // });
        tmpDir = array.join('/');

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
            this._mkdir(array);
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
    },
    _mkdir : function mkdir(array) {
        var dir = array.join('/');
        if (!FS.existsSync(dir)) {
            mkdir(array.splice(0, array.length - 1));
            try {
                FS.mkdirSync(dir);
            } catch (err) {
                console.log(err);
            }
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
        if (_.isObject(object)) {
            return JSON.stringify(object);
        }
        return object;
    },
    deserialize : function(data, options) {
        if (_.isString(data)) {
            return JSON.parse(data);
        }
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

var TileService = Mosaic.Class.extend({

    /**
     * Returns an tiles provider based on intermediate vector tiles.
     */
    _newVectorBasedTileSource : function() {
        var that = this;
        // Internal caching provider for vector tiles
        var vectorCache = that._newTileCache({
            getCacheHandler : function(options) {
                return new Cache.Handler({
                    serialize : function(object, options) {
                        var vtile = object.vtile;
                        return vtile.getData();
                    },
                    deserialize : function(data, options) {
                        return options.renderer.exec(function(r) {
                            return r.loadVectorTile(data, options);
                        });
                    },
                    create : function(options) {
                        return options.renderer.exec(function(r) {
                            return r.buildVectorTile(options);
                        });
                    }
                });
            }
        });
        return that._newTileCache({
            getCacheHandler : function() {
                return new Cache.Handler({
                    create : function(options) {
                        var key = that._getCacheKey('vtile', options);
                        return vectorCache.load(key, options)//
                        .then(
                                function(vector) {
                                    return options.renderer.exec(function(r) {
                                        console.log('options.buffer_size',
                                                options.buffer_size);
                                        var params = _.extend({}, options,
                                                vector);
                                        return r.renderVectorTile(params);
                                    })
                                });
                    }
                });
            },
        });
    },

    /** This tiles provider directly generates image tiles. */
    _newImageTileSource : function() {
        var that = this;
        return that._newTileCache({
            getCacheHandler : function() {
                return new Cache.Handler({
                    create : function(options) {
                        return options.renderer.exec(function(r) {
                            return r.renderTile(options);
                        })
                    }
                });
            },
        });
    },

    initialize : function(options) {
        this.setOptions(options);
        // this._tilesCache = this._newVectorBasedTileSource();
        this._tilesCache = this._newImageTileSource();
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
        return that._loadRenderer(params).then(function(renderer) {
            that._extendParams(params, renderer);
            var key = that._getCacheKey(params.format, params);
            return that._tilesCache.load(key, params);
        });
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
        return _.extend({}, this.options, options, {
            sourceKey : sourceKey,
            format : format,
            z : zoom,
            x : x,
            y : y
        });
    },

    _extendParams : function(options, renderer) {
        var config = renderer.options.config;
        var interactivity = config.interactivity || {};
        interactivity.fields = '' + (interactivity.fields || '');
        interactivity.fields = //
        _.isString(interactivity.fields) ? //
        interactivity.fields.split(',') : //
        _.toArray(interactivity.fields);
        _.extend(options, interactivity);
        options.buffer_size = renderer.options.buffer_size || //
        config.buffer_size || options.buffer_size || //
        this.options.buffer_size || 128;
        options.renderer = renderer;
        return options;
    },

    _getCacheKey : function(format, params) {
        var key;
        if (_.isFunction(params.getCacheKey)) {
            key = params.getCacheKey.apply(params, arguments);
        } else {
            key = 'tile-' + params.z + '-' + params.x + '-' + params.y;
            key = params.sourceKey + ':' + format + ':' + key + '.' + format;
        }
        return key;
    },

    _loadRenderer : function(options) {
        var that = this;
        if (!that._renderers) {
            var timeout = this.options.rendererTimeout || 10 * 60 * 1000;
            this._renderers = new LRU({
                dispose : function(key, promise) {
                    if (promise) {
                        promise.then(function(renderer) {
                            renderer.close();
                        });
                    }
                },
                maxAge : timeout
            });
        }
        return Mosaic.P.then(function() {
            var sourceKey = that._getRendererCacheKey(options);
            var promise = that._renderers.get(sourceKey);
            if (!promise) {
                promise = that._newRenderer(options);
                that._renderers.set(sourceKey, promise);
            }
            return promise;
        });
    },

    _getRendererCacheKey : function(options) {
        options = options || {};
        var key;
        var getRendererCacheKey = options.getRendererCacheKey
                || this.options.getRendererCacheKey;
        if (_.isFunction(getRendererCacheKey)) {
            key = getRendererCacheKey.apply(options, arguments);
        } else {
            key = options.sourceKey;
        }
        return key;
    },
    _newRenderer : function(options) {
        var that = this;
        var sourceKey = options.sourceKey;
        var projectDir = that._getProjectDir(sourceKey);
        options.projectDir = projectDir;
        var loader = that._getMapnikConfigLoader(sourceKey);
        return loader.loadProjectFromDir(options).then(
                function(project) {
                    FS.writeFileSync(projectDir + '/tmp.json', JSON.stringify(
                            project, null, 2), 'UTF-8');
                    var style = project.Stylesheet[0].data;
                    FS.writeFileSync(projectDir + '/tmp.mss', style, 'UTF-8');
                    return loader.transformMmlToMss(project);
                }).then(function(options) {
            // console.log(JSON.stringify(options.config, null, 2));
            FS.writeFileSync(projectDir + '/tmp.xml', options.xml, 'UTF-8');
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
