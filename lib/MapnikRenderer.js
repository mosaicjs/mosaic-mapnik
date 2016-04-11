var path = require('path');
var mapnik = require('mapnik');
var SphericalMercator = require('sphericalmercator');
var Utils = require('./Utils');
var ninvoke = Utils.ninvoke;
var extend = Utils.extend;

mapnik.register_system_fonts();
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
        this._tmpDir = this.options.tmpDir || './tmp';
        if (!fs.existsSync(this._tmpDir)) {
            fs.mkdirSync(this._tmpDir);
        }
        this._mercator = new SphericalMercator({
            size : this.options.tileSize
        });
    },

    render : function(options) {
        var that = this;
        return Promise.resolve().then(function() {
            var filePromiseIndex = that._filePromiseIndex //
            = that._filePromiseIndex || {};
            var file = that._getOutputFile(options);
            var promise = filePromiseIndex[file] || //
            that._withPromise(file, function() {
                return that.renderToFile(options);
            }, filePromiseIndex);
            return promise.then(function() {
                return ninvoke(fs, 'readFile', file);
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
            var map = params.map;
            if (!map) {
                throw new Error('Map is not defined.');
            }
            var tile = that._prepareTile(params);
            return ninvoke(vtile, vtile.render, map, tile, params)//
            .then(function(img) {
                return that._encodeTile(img, params);
            });
        });
    },

    renderTile : function(options) {
        var that = this;
        return that._withMap(options, function(params) {
            var tile = that._prepareTile(params);
            var map = params.map;
            return ninvoke(map, map.render, tile, params).then(function(img) {
                return that._encodeTile(img, params);
            });
        })
    },

    renderToFile : function(options) {
        var that = this;
        return Promise.resolve().then(function() {
            options = that.checkMapOptions(options);
            var file = that._getOutputFile(options);
            that._checkDir(path.dirname(file));
            return that._withMap(options, function(params) {
                var map = params.map;
                var size = options.size;
                map.extent = options.bbox;
                // map.width = +size[0];
                // map.height = +size[1];
                map.resize(+size[0], +size[1]);
                options.extent = options.bbox;
                return ninvoke(map, 'renderFile', options.file, options);
            });
        });
    },

    _getOutputFile : function(options) {
        return options.file = options.file || this.getOutputFile(options);
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
        options.zoom = !isNaN(options.zoom) ? +options.zoom : 8;
        options.scale = options.scale || 1.0;
        var bbox = options.bbox;
        if (!bbox) {
            var w = Math.min(options.west, options.east);
            var s = Math.min(options.north, options.south);
            var e = Math.max(options.west, options.east);
            var n = Math.max(options.north, options.south);
            bbox = options.bbox = [ w, s, e, n ];
        }
        // var srs = options.srs || this.options.srs;
        // options.bbox = this._mercator.convert(bbox, srs);
        var firstPoint = this._mercator.px([ bbox[0], bbox[1] ], options.zoom);
        var secondPoint = this._mercator.px([ bbox[2], bbox[3] ], options.zoom);
        options.size = [ Math.abs(firstPoint[0] - secondPoint[0]),
                Math.abs(firstPoint[1] - secondPoint[1]) ];
        return options;
    },

    getOutputFile : function(options) {
        var outputFileName = 'map-' + options.zoom //
                + '-[' + options.bbox.join(',') + '].' + options.format;
        var dir = options.dir || this._tmpDir;
        var outputFile = path.join(dir, outputFileName);
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

    _checkDir : function(dir) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }
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
        promises = promises || that;
        var result = (promises[key] || Promise.resolve()).then(function() {
            return action.call(that);
        });
        var promise = promises[key] = result.then(clean, clean);
        return result;
        function clean() {
            if (promise === promises[key]) {
                delete promises[key];
            }
        }
    },

    _prepareTile : function(params) {
        var format = params.format || 'png';
        var tile;
        if (format === 'utf') {
            tile = new mapnik.Grid(params.width, params.height);
        } else {
            tile = new mapnik.Image(params.width, params.height);
        }
        return tile;
    },

    _encodeTile : function(img, params) {
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

module.exports = MapnikRenderer;
