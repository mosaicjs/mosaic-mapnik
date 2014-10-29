var Mosaic = require('mosaic-commons');
var Mapnik = require('mapnik');
var Mercator = new (require('sphericalmercator'));

Mapnik.register_default_fonts();
Mapnik.register_default_input_plugins();

var FS = require('fs');
var Path = require('path');

var MapnikRenderer = Mosaic.Class.extend({

    initialize : function(options){
        this.setOptions(options);
        this._tmpDir = this.options.tmpDir || './tmp';
        if (!FS.existsSync(this._tmpDir)) {
            FS.mkdirSync(this._tmpDir);
        }
    },

    renderMap : function(options) {
        var that = this;
        return Mosaic.P.then(function() {
            that.checkMapOptions(options);
            return that.withFile(options.file,
                that.renderToFile.bind(that, options))
                .then(function() {
                    return that.getOutputHeaders(options.file,
                        options.format);
            });
        })
    },

    renderToFile : function(options){
        var that = this;
        return Mosaic.P.then(function(){
            that.checkMapOptions(options);
            var width = options.size.width;
            var height = options.size.height;
            var map = new Mapnik.Map(width, height);
            map.extent = options.bbox;
            return Mosaic.P.ninvoke(map, 'fromString',
                options.xml, options).then(function(map) {
                return Mosaic.P.ninvoke(map,
                    'renderFile', options.file, options);
            });
        }).then(function(){
            return that.getOutputHeaders(options.file, options.format);
        });
    },

    getOutputHeaders : function(file, format){
        var mime;
        switch (format) {
        case 'png':
            mime = 'image/png';
            break;
        case 'pdf':
            mime = 'application/pdf';
            break;
        case 'svg':
            mime = 'image/svg+xml';
            break;
        }
        return {
            file : file,
            headers : {
                'Content-Type' : mime
            }
        };
    },

    _getSourceId : function(params) {
        var source = params.sourceId || params.source ||  '';
        source = source.replace(/[\\\/\-&]/gim, '_');
        return source;
    },

    checkMapOptions : function(options){
        options.sourceId = options.sourceId || options.source || '';
        options.format = options.format || 'pdf';
        options.zoom = options.zoom || 8;
        options.scale = options.scale || 1.0;
        var w = Math.min(options.west, options.east);
        var s = Math.min(options.north, options.south);
        var e = Math.max(options.west, options.east);
        var n = Math.max(options.north, options.south);
        options.bbox = Mercator.convert([ w, s, e, n ], '900913');
        var firstPoint = Mercator.px([ w, s ], options.zoom);
        var secondPoint = Mercator.px([ e, n ], options.zoom);
        options.size = {
            width : Math.abs(firstPoint[0] - secondPoint[0]),
            height : Math.abs(firstPoint[1] - secondPoint[1])
        };
        options.file = options.file || this.getOutputFile(options);
        return options;
    },

    getOutputFile : function(options){
        var sourceId = this._getSourceId(options);
        var outputFileName = 'map-' + sourceId + '-' + options.zoom //
                + '-[' + options.bbox.join(',') + '].' + options.format;
        var tmpDir = this._tmpDir;
        var outputFile = Path.join(tmpDir, outputFileName);
        return outputFile;
    },

    withFile : function(outputFile, action) {
        var that = this;
        var filePromiseIndex = that._filePromiseIndex || {};
        that._filePromiseIndex = filePromiseIndex;
        var promise = filePromiseIndex[outputFile];
        if (!promise && FS.existsSync(outputFile)) {
            promise = Mosaic.P();
        }
        if (!promise) {
            promise = filePromiseIndex[outputFile] =
            Mosaic.P.then(function() {
                return action();
            }).then(function(result) {
                delete filePromiseIndex[outputFile];
                return result;
            });
        }
        return promise.then(function(){
            return Mosaic.P.ninvoke(FS, 'readFile', outputFile);
        });
    }

});

module.exports = MapnikRenderer;
