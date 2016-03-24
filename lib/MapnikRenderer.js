var path = require('path');
var mapnik = require('mapnik');
var SphericalMercator = require('sphericalmercator');

mapnik.register_default_fonts();
mapnik.register_default_input_plugins();
// mapnik.register_datasource(path.join(mapnik.settings.paths.input_plugins,
// 'shape.input'));

var fs = require('fs');
var path = require('path');

function MapnikRenderer(options) {
    options = options || {};
    this.initialize(options);
}

MapnikRenderer.prototype = {

    options : {
        tileSize : 256,
        bufferSize : 64,
        srs : 'WGS84' // 'WGS84' || '900913'
    },

    initialize : function(options) {
        this.options = extend({}, this.options, options);
        this._mercator = new SphericalMercator({
            size : this.options.tileSize
        });
    },

    render : function(options) {
        var that = this;
        return Promise.resolve().then(function() {
            options = that.checkMapOptions(options);
            var filePromiseIndex = that._filePromiseIndex //
            = that._filePromiseIndex || {};
            var promise = filePromiseIndex[options.file] || //
            that._withPromise(options.file, function() {
                return that.renderToFile(options);
            }, filePromiseIndex);
            return promise.then(function() {
                return ninvoke(fs, 'readFile', options.file);
            }).then(function(buffer) {
                options.buffer = buffer;
                that._addOutputHeaders(options, options.format);
                return options;
            });
        });
    },

    loadVectorTile : function(data, params) {
        return Promise.resolve().then(function() {
            var vtile = new mapnik.VectorTile(params.z, params.x, //
            params.y, params);
            params.vtile = vtile;
            if (!data.length)
                return;
            return ninvoke(vtile, vtile.setData, data)//
            .then(function() {
                return ninvoke(vtile, vtile.parse);
            });
        }).then(function() {
            return params;
        });
    },

    buildVectorTile : function(options) {
        var that = this;
        return that._withMap(options, function(params) {
            var vtile = new mapnik.VectorTile(params.z, params.x, params.y,
                    params);
            params.vtile = vtile;
            var map = params.map;
            return ninvoke(map, map.render, vtile, params).then(function() {
                delete params.map;
                return params;
            });
        });
    },

    renderVectorTile : function(options) {
        var that = this;
        return that._withMap(options, function(params) {
            var vtile = params.vtile;
            if (!vtile) {
                throw new Error('Vector tile is not defined.');
            }
            var image = that._prepareImage(params);
            return ninvoke(vtile, vtile.render, params.map, image, params)//
            .then(function(img) {
                return that._encodeImage(img, params);
            });
        });
    },

    renderTile : function(options) {
        var that = this;
        return that._withMap(options, function(params) {
            var image = that._prepareImage(params);
            var map = params.map;
            return ninvoke(map, map.render, image, params).then(function(img) {
                return that._encodeImage(img, params);
            });
        })
    },

    renderToFile : function(options) {
        var that = this;
        return that._withMap(options, function(params) {
            var map = params.map;
            var size = options.size;
            map.clear();
            map.extent = options.bbox;
            // map.width = +size[0];
            // map.height = +size[1];
            map.resize(+size[0], +size[1]);
            options.extent = options.bbox;
            return ninvoke(map, 'renderFile', options.file, options);
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

    _addOutputHeaders : function(options, format) {
        var mime = this.getMimeType(format);
        options.headers = {
            'Content-Type' : mime
        };
        return options;
    },

    checkMapOptions : function(options) {
        options.format = options.format || 'pdf';
        options.zoom = options.zoom || 8;
        options.scale = options.scale || 1.0;
        var w = Math.min(options.west, options.east);
        var s = Math.min(options.north, options.south);
        var e = Math.max(options.west, options.east);
        var n = Math.max(options.north, options.south);
        var srs = options.srs || this.options.srs;
        options.bbox = this._mercator.convert([ w, s, e, n ], srs);
        var firstPoint = this._mercator.px([ w, s ], options.zoom);
        var secondPoint = this._mercator.px([ e, n ], options.zoom);
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
        var outputFile = path.join(tmpDir, outputFileName);
        return outputFile;
    },

    _loadMap : function() {
        var that = this;
        if (!that.__loadMap) {
            that.__loadMap = Promise.resolve()//
            .then(function() {
                var tileSize = that.options.tileSize;
                var bufferSize = that.options.bufferSize;
                var map = new mapnik.Map(tileSize, tileSize);
                options = extend({}, that.options, {
                    bufferSize : bufferSize,
                    buffer_size : bufferSize,
                    'buffer-size' : bufferSize
                });
                map.bufferSize = map.buffer_size = bufferSize;
                return ninvoke(map, map.fromString, //
                options.xml, options).then(null, function() {
                    // Re-try the same operation using a sync call
                    return map.fromStringSync(options.xml, options);
                }).then(function() {
                    return map;
                });
            });
        }
        return that.__loadMap;
    },

    _withMap : function(options, action) {
        var that = this;
        return that._withPromise('__withMap', function() {
            return that._loadMap().then(function(map) {
                var z = +options.z;
                var x = +options.x;
                var y = +options.y;
                var srs = options.srs || that.options.srs;
                map.extent = that._mercator.bbox(x, y, z, false, srs);
                var tileSize = that.options.tileSize;
                map.resize(tileSize, tileSize);
                var bufferSize = that.options.bufferSize;
                map.buffer_size = bufferSize;
                var format = options.format || 'png';
                return extend({}, options, {
                    z : z,
                    x : x,
                    y : y,
                    width : tileSize,
                    height : tileSize,
                    map : map,
                    format : format,
                    buffer_size : bufferSize,
                });
            }).then(action);
        });
    },

    _withPromise : function(key, action, promises) {
        var that = this;
        promises = promises || this;
        if (!promises[key]) {
            promises[key] = Promise.resolve();
        }
        var promise;
        return promise = promises[key] = promises[key].then(function() {
            return action.call(that);
        }).then(function(result) {
            if (promise === promises[key]) {
                delete promises[key];
            }
            return result;
        }, function(err) {
            if (promise === promises[key]) {
                delete promises[key];
            }
            throw err;
        });
    },

    _prepareImage : function(params) {
        var format = params.format || 'png';
        var image;
        if (format === 'utf') {
            image = new mapnik.Grid(params.width, params.height);
        } else {
            image = new mapnik.Image(params.width, params.height);
        }
        return image;
    },

    _encodeImage : function(img, params) {
        if (img instanceof mapnik.Grid) {
            var grid = img;
            var resolution = params.resolution || 4;
            params.resolution = params.resolution || 4;
            return ninvoke(grid, grid.encode, params);
        } else {
            var view = img.view(0, 0, params.width, params.height);
            return ninvoke(view, view.encode, params.format, params);
        }
    },

}

function ninvoke(context, method) {
    var args = [];
    for (var i = 2; i < arguments.length; i++) {
        args.push(arguments[i]);
    }
    return new Promise(function(resolve, reject) {
        try {
            if (typeof method === 'string') {
                method = context[method];
            }
            args.push(function(err, result) {
                if (err)
                    return reject(err);
                else
                    return resolve(result);
            });
            return method.apply(context, args);
        } catch (err) {
            return reject(err);
        }
    });
}

function extend(target) {
    for (var i = 1; i < arguments.length; i++) {
        var source = arguments[i];
        for ( var key in source) {
            if (source.hasOwnProperty(key)) {
                target[key] = source[key];
            }
        }
    }
    return target;
}

module.exports = MapnikRenderer;
