var Mosaic = require('mosaic-commons');
var Millstone = require('millstone');
var Carto = require('carto');

var FS = require('fs');
var Path = require('path');

/**
 * This utility class is used to load TileMill projects; it resolves all
 * external references and generates valid Mapnik XML configurations.
 */
var MapnikConfigLoader = Mosaic.Class.extend({

    initialize : function(options) {
        this.setOptions(options);
        this._tmpDir = this.options.tmpDir || './tmp';
        if (!FS.existsSync(this._tmpDir)) {
            FS.mkdirSync(this._tmpDir);
        }
    },

    /**
     * Loads TileMill project and transforms it to Mapnik XML configuration. All
     * references are resolved relative to the specified base directory.
     */
    loadMss : function(baseDir, file) {
        var that = this;
        return that.loadProject(baseDir, file).then(function(style) {
            return that.transformMmlToMss(style);
        });
    },

    /**
     * Transforms loaded MSS object (styles + datasources) to a valid Mapnik XML
     * configuration. All references are resolved relative to the specified base
     * directory.
     */
    loadMssFromMml : function(baseDir, mml) {
        var that = this;
        return that.loadProjectMml(baseDir, mml).then(function(style) {
            return that.transformMmlToMss(style);
        });
    },

    /**
     * Transforms style objects (TileMill layers + styles) to a valid Mapnik XML
     * configuration. This method returns an object containing two fields: a)
     * config contains the original style as a JSON object b) xml contains a
     * valid XML Mapnik configuration
     */
    transformMmlToMss : function(style) {
        var renderer = new Carto.Renderer({});
        var xml = renderer.render(style);
        return {
            config : style,
            xml : xml
        };
    },

    /**
     * Loads a TileMill configuration from the specified directory. This method
     * tries to load a dynamic script from a "project.js" file in this directory
     * and if it does not exist then it tries to load the "project.mml" file.
     */
    loadProjectFromDir : function(options) {
        var path, mml;
        var projectDir = options.projectDir || './';
        if (!options.disableScripts) {
            path = Path.resolve(projectDir, 'project.js');
            if (FS.existsSync(path)) {
                var req = options.require || require;
                delete req.cache[path];
                var script = req(path);
                if (typeof script === 'function') {
                    mml = script(options);
                } else {
                    mml = script;
                }
            }
        }
        if (!mml) {
            path = Path.resolve(projectDir, 'project.mml');
            mml = JSON.parse(FS.readFileSync(path));
        }
        return this.loadProjectMml(projectDir, mml);
    },

    /**
     * Loads a Tilemill configuration from the specified directory, resolves all
     * references to external sources (ex: datasources, images etc) and
     * transforms this project object to a valid Mapnik XML configuration. All
     * references are resolved relative to the specified base directory.
     */
    loadProject : function(baseDir, file) {
        file = file || 'project.mml';
        var path = Path.resolve(baseDir, file);
        var mml = JSON.parse(FS.readFileSync(path));
        return this.loadProjectMml(baseDir, mml);
    },

    /**
     * Resolves all external references in the specified Tilemill configuration
     * object (ex: to external datasources, images etc) and transforms this
     * object to a valid Mapnik XML configuration. All references are resolved
     * relative to the specified base directory.
     */
    loadProjectMml : function(baseDir, mml) {
        var options = {
            mml : mml,
            base : baseDir,
            cache : this._tmpDir
        };
        return Mosaic.P.ninvoke(Millstone, Millstone.resolve, options);
    },

});

module.exports = MapnikConfigLoader;
