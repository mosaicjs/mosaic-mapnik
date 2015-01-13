var Mosaic = require('mosaic-commons');
var Mapnik = require('mapnik');
var SphericalMercator = require('sphericalmercator');
var poolModule = require('generic-pool');
var _ = require('underscore');

Mapnik.register_default_fonts();
Mapnik.register_default_input_plugins();

var FS = require('fs');
var Path = require('path');

var MapnikRenderer = Mosaic.Class.extend({

    /**
     * @param options.xml
     *            XML mapnik configuration
     * @param options.sourceId
     *            identifier of this Mapnik configuration
     * @param options.base
     *            base path to the XML; used to resolve relative references (ex:
     *            references to images etc)
     * @param options.tmpDir
     *            path to a temporary directory where generated files should be
     *            stored.
     */
    initialize : function(options) {
        this.close = _.bind(this.close, this);
        this.setOptions(options);
        this._tmpDir = this.options.tmpDir || './tmp';
        this._mercator = new SphericalMercator({
            size : this.getTileSize()
        });
        if (!FS.existsSync(this._tmpDir)) {
            FS.mkdirSync(this._tmpDir);
        }
        var poolSize = this.options.poolSize || process.env.UV_THREADPOOL_SIZE
                || require('os').cpus().length;
        var that = this;
        this._pool = poolModule.Pool({
            name : 'mapnik',
            create : function(callback) {
                var tileSize = that.getTileSize();
                that._newMapnikInstance({
                    tileSize : tileSize,
                    width : tileSize,
                    height : tileSize
                }).then(function(result) {
                    callback(null, result);
                }, function(err) {
                    callback(err);
                })
            },
            destroy : function(map) {
            },
            max : poolSize,
            idleTimeoutMillis : that.options.poolTimeout || 30000,
            log : this.options.log
        });
    },

    /** Returns the tile size */
    getTileSize : function() {
        var options = this.options;
        var config = options.config || {};
        var tileSize = config.tileSize || 256;
        return tileSize;
    },

    getTileBufferSize : function() {
        var options = this.options;
        var config = options.config || {};
        return config.buffer_size || 128;
    },

    /**
     * The main method of this class. It executes the specified action with
     * provided renderer.
     */
    exec : function(action) {
        var that = this;
        return Mosaic.P.then(function() {
            var map;
            return Mosaic.P.ninvoke(that._pool, that._pool.acquire)//
            .then(function(m) {
                map = m;
                var options = _.extend({}, that.options, {
                    map : map,
                    sourceId : that._getSourceId(),
                    renderer : that
                });
                var renderer = new MapnikRenderer.Executor(options);
                return action(renderer);
            }).then(function(result) {
                that._pool.release(map);
                return result;
            }, function(err) {
                if (map) {
                    that._pool.release(map);
                }
                throw err;
            });
        });
    },

    _getSourceId : function() {
        var source = this.options.sourceId || this.options.source || '';
        return source;
    },

    /**
     * Prepares and returns a MapnikRenderer map object.
     */
    _newMapnikInstance : function(options) {
        var that = this;
        return Mosaic.P.then(function() {
            var bufferSize = that.getTileBufferSize();
            var map = new Mapnik.Map(options.width, options.height);
            options = _.extend({}, that.options, {
                bufferSize : bufferSize,
                buffer_size : bufferSize
            }, options);
            map.bufferSize = map.buffer_size = bufferSize;
            return Mosaic.P.ninvoke(map, map.fromString, options.xml, options)
                    .then(null, function() {
                        // Re-try the same operation using a sync call
                        return map.fromStringSync(options.xml, options);
                    }).then(function() {
                        return map;
                    });
        });
    },

    close : function() {
        var that = this;
        return Mosaic.P.then(function() {
            var deferred = Mosaic.P.defer();
            try {
                var pool = that._pool;
                // pool.drain(function() {
                pool.destroyAllNow(function() {
                    deferred.resolve();
                });
                // });
            } catch (err) {
                deferred.reject(err);
            }
            return deferred.promise;
        });
    }

});

MapnikRenderer.Executor = Mosaic.Class.extend({

    initialize : function(options) {
        this.setOptions(options);
    },

    getTileSize : function() {
        return this.options.renderer.getTileSize();
    },

    _getMercator : function() {
        return this.options.renderer._mercator;
    },

    getMap : function() {
        return this.options.map;
    },

    renderMap : function(options) {
        var that = this;
        return Mosaic.P.then(function() {
            options = that.checkMapOptions(options);
            return that.withFile(options.file, function() {
                return that.renderToFile(options);
            }).then(function() {
                return that.getOutputHeaders(options.file, options.format);
            });
        })
    },

    _prepareMap : function(options) {
        var z = +options.z;
        var x = +options.x;
        var y = +options.y;
        var mercator = this._getMercator();
        var srs = options.srs || '900913';
        var bbox = mercator.bbox(x, y, z, false, srs);
        var tileSize = this.getTileSize();
        var map = this.getMap();
        map.extent = bbox;
        map.resize(tileSize, tileSize);
        var format = options.format || 'png';
        return _.extend({}, options, {
            z : z,
            x : x,
            y : y,
            width : tileSize,
            height : tileSize,
            map : map,
            format : format
        });
    },

    _prepareImage : function(params) {
        var format = params.format || 'png';
        var image;
        if (format === 'utf') {
            image = new Mapnik.Grid(params.width, params.height);
        } else {
            image = new Mapnik.Image(params.width, params.height);
        }
        return image;
    },

    _encodeImage : function(img, params) {
        var view = img.view(0, 0, params.width, params.height);
        return Mosaic.P.ninvoke(view, view.encode, params.format, params);
    },

    loadVectorTile : function(data, params) {
        return Mosaic.P.then(function() {
            var vtile = new Mapnik.VectorTile(params.z, params.x, //
            params.y, params);
            params.vtile = vtile;
            if (!data.length)
                return;
            return Mosaic.P.ninvoke(vtile, vtile.setData, data)//
            .then(function() {
                return Mosaic.P.ninvoke(vtile, vtile.parse);
            });
        }).then(function() {
            return params;
        });
    },

    buildVectorTile : function(options) {
        var that = this;
        return Mosaic.P.then(function() {
            var params = that._prepareMap(options);
            var vtile = new Mapnik.VectorTile(params.z, params.x, params.y,
                    params);
            params.vtile = vtile;
            var map = params.map;
            return Mosaic.P.ninvoke(map, map.render, vtile, params).then(
                    function() {
                        delete params.map;
                        return params;
                    });
        });
    },

    renderVectorTile : function(options) {
        var that = this;
        return Mosaic.P.then(function() {
            var params = that._prepareMap(options);
            var vtile = params.vtile;
            if (!vtile) {
                throw new Error('Vector tile is not defined.');
            }
            var image = that._prepareImage(params);
            return Mosaic.P.ninvoke(vtile, vtile.render, params.map, image)
                    .then(function(img) {
                        return that._encodeImage(img, params);
                    });
        });
    },

    renderTile : function(options) {
        var that = this;
        return Mosaic.P.then(function() {
            var params = that._prepareMap(options);
            var image = that._prepareImage(params);
            var map = params.map;
            return Mosaic.P.ninvoke(map, map.render, image, params).then(
                    function(img) {
                        return that._encodeImage(img, params);
                    });
        });
    },

    renderToFile : function(options) {
        var that = this;
        return Mosaic.P.then(function() {
            options = that.checkMapOptions(options);
            var map = that.getMap();
            map.clear();
            map.extent = options.bbox;
            var size = options.size;
            // map.width = +size[0];
            // map.height = +size[1];
            map.resize(+size[0], +size[1]);
            options.extent = options.bbox;
            return Mosaic.P.ninvoke(map, 'renderFile', options.file, options);
        }).then(function() {
            return that.getOutputHeaders(options.file, options.format);
        });
    },

    getMimeType : function(format) {
        var mime;
        switch (format) {
        case 'utf':
            mime = 'application/json';
            break;
        case 'png':
            mime = 'image/png';
            break;
        case 'pdf':
            mime = 'application/pdf';
            break;
        case 'svg':
            mime = 'image/svg+xml';
            break;
        default:
            mime = 'application/octet-stream';
            break;
        }
        return mime;
    },

    getOutputHeaders : function(file, format) {
        var mime = this.getMimeType(format);
        return {
            file : file,
            headers : {
                'Content-Type' : mime
            }
        };
    },

    checkMapOptions : function(options) {
        options.format = options.format || 'pdf';
        options.zoom = options.zoom || 8;
        options.scale = options.scale || 1.0;
        var w = Math.min(options.west, options.east);
        var s = Math.min(options.north, options.south);
        var e = Math.max(options.west, options.east);
        var n = Math.max(options.north, options.south);
        var mercator = this._getMercator();
        var srs = options.srs || '900913';
        options.bbox = mercator.convert([ w, s, e, n ], srs);
        var firstPoint = mercator.px([ w, s ], options.zoom);
        var secondPoint = mercator.px([ e, n ], options.zoom);
        options.size = [ Math.abs(firstPoint[0] - secondPoint[0]),
                Math.abs(firstPoint[1] - secondPoint[1]) ];
        options.file = options.file || this.getOutputFile(options);
        return options;
    },

    getOutputFile : function(options) {
        var sourceId = this.options.sourceId;
        var outputFileName = 'map-' + sourceId + '-' + options.zoom //
                + '-[' + options.bbox.join(',') + '].' + options.format;
        var tmpDir = this._tmpDir;
        var outputFile = Path.join(tmpDir, outputFileName);
        return outputFile;
    },

    withFile : function(outputFile, action) {
        var that = this;
        var filePromiseIndex = that._filePromiseIndex || {};
        that._filePromiseIndex = filePromiseIndex;
        var promise = filePromiseIndex[outputFile];
        if (!promise && FS.existsSync(outputFile)) {
            promise = Mosaic.P();
        }
        if (!promise) {
            promise = filePromiseIndex[outputFile] = Mosaic.P.then(function() {
                return action();
            }).then(function(result) {
                delete filePromiseIndex[outputFile];
                return result;
            });
        }
        return promise.then(function() {
            return Mosaic.P.ninvoke(FS, 'readFile', outputFile);
        });
    }

});

module.exports = MapnikRenderer;
