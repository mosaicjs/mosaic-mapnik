var Mosaic = require('mosaic-commons');
var Millstone = require('millstone');
var Carto = require('carto');

var FS = require('fs');
var Path = require('path');

var MapnikConfigLoader = Mosaic.Class.extend({

    initialize : function(options){
        this.setOptions(options);
        this._tmpDir = this.options.tmpDir || './tmp';
        if (!FS.existsSync(this._tmpDir)) {
            FS.mkdirSync(this._tmpDir);
        }
    },

    loadMss : function(baseDir, file) {
        var that = this;
        return that.loadProject(baseDir, file)
        .then(function(style) {
            var xml = that.transformMmlToMss(style);
            return {
                config : style,
                xml : xml
            }
        });
    },

    loadProject : function(baseDir, file) {
        file = file || 'project.mml';
        var mml = JSON.parse(FS.readFileSync(Path.join(baseDir, file)));
        var options = {
            mml: mml,
            base: baseDir,
            cache: this._tmpDir
        };
        var that = this;
        return Mosaic.P.ninvoke(Millstone, Millstone.resolve, options);
    },

    transformMmlToMss : function(style){
        var renderer = new Carto.Renderer({});
        return renderer.render(style);
    },
});

module.exports = MapnikConfigLoader;
