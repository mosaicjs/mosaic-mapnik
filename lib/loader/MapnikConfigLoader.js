var carto = require('carto');
var fs = require('fs');
var path = require('path');
var millstone = require('millstone');
var CartoCssSerializer = require('./CartoCssSerializer').CartoCssSerializer;
var Utils = require('../Utils');
var extend = Utils.extend;

function MapnikConfigLoader() {
    this.initialize.apply(this, arguments);
}

/**
 * This utility class is used to load TileMill projects; it resolves all
 * external references and generates valid Mapnik XML configurations.
 */
MapnikConfigLoader.prototype = {

    initialize : function(options) {
        this.options = options || {};
        this.options.baseDir = this.options.baseDir || './';
        this._tmpDir = this.options.tmpDir || './tmp';
        if (!fs.existsSync(this._tmpDir)) {
            fs.mkdirSync(this._tmpDir);
        }
    },

    /**
     * Transforms style objects (TileMill layers + styles) to a valid Mapnik XML
     * configuration. This method returns an object containing two fields: a)
     * config contains the original style as a JSON object b) xml contains a
     * valid XML Mapnik configuration
     * 
     * @param options.mml
     *            a mml config object
     * @param options.file
     *            a mml file
     * @param options.dir
     *            a base directory for the file
     */
    readProject : function(options) {
        var that = this;
        return that._resolveMmlReferences(options).then(function(options) {
            return that._generateXmlConfiguration(options);
        });
    },

    /**
     * Loads and merge specified configuration objects (TileMill layers +
     * styles) to a valid Mapnik XML configuration. This method returns an
     * object containing two fields: a) resulting MML (JSON) configuration b)
     * final valid XML Mapnik configuration
     * 
     * @param options
     *            list of project conigurations to load and merge
     * @param options[i].mml
     *            a mml config object
     * @param options[i].file
     *            a mml file
     * @param options[i].dir
     *            a base directory for the file
     */
    readProjects : function(options, optionsList) {
        var that = this;
        optionsList = Array.isArray(optionsList) ? optionsList
                : optionsList ? [ optionsList ] : [];
        return Promise.all(optionsList.map(function(opt) {
            return that._resolveMmlReferences(opt, options);
        })).then(function(projects) {
            that._mergeProjects(options, projects);
            return that._generateXmlConfiguration(options);
        });
    },

    /**
     * Generates a Mapnik XML configuration based on the specified MML (JSON)
     * configuration. The given MML object should contain already resolved
     * references to used resources.
     * 
     * @param options.mml
     *            a mml config object
     * @param options.file
     *            a mml file
     * @param options.dir
     *            a base directory for the file
     */
    _generateXmlConfiguration : function(options) {
        return Promise.resolve().then(function() {
            var renderer = new carto.Renderer({
                filename : path.basename(options.file),
                local_data_dir : options.dir,
            });
            var mml = options.mml;
            var xml = renderer.render(mml);
            return {
                mml : mml,
                xml : xml
            };
        });
    },

    _mergeProjects : function(options, list) {
        var configs = list.map(function(config) {
            return config.mml;
        });
        options.mml = this._resolveValue(options.mml, options, options, {
            "srs" : "+init=epsg:4326"
        });
        this._mergeProjectInteractivity(options.mml, configs, options);
        this._mergeProjectStyles(options.mml, configs, options);
        this._mergeProjectDataLayers(options.mml, configs, options);
        return options;
    },

    _mergeProjectInteractivity : function(target, sources, options) {
        sources.forEach(function(source) {
            if (source.interactivity && !target.interactivity) {
                var interactivity = this._resolveValue(source.interactivity,
                        source, options, []);
                target.interactivity = interactivity;
            }
        }, this);
        return target;
    },

    _mergeProjectStyles : function(target, sources, options) {
        target.Stylesheet = target.Stylesheet || [];
        (sources || []).forEach(function(source) {
            if (!source.Stylesheet)
                return;
            var Stylesheet = this._resolveValue(source.Stylesheet, source,
                    options, []);
            Stylesheet.forEach(function(style) {
                style = this._resolveValue(style, source, options, []);
                target.Stylesheet.push(style);
            }, this);
        }, this);
        return target;
    },

    _mergeProjectDataLayers : function(target, sources, options) {
        target.Layer = target.Layer || [];
        var index = {};
        (sources || []).forEach(function(source) {
            if (!source.Layer)
                return;
            var Layer = this._resolveValue(source.Layer, source, options, []);
            Layer.forEach(function(layer) {
                layer = this._resolveValue(layer, source, options, []);
                index[layer.name] = layer;
            }, this);
        }, this);
        for ( var name in index) {
            var layer = index[name];
            target.Layer.push(layer);
        }
        return target;
    },

    _resolveMmlReferences : function(options) {
        var that = this;
        return Promise.resolve().then(function() {
            that._resolveMmlFile(options);
            var mml;
            if (options.mml) {
                mml = that._resolveField(options, options.mml);
            } else {
                mml = that._resolveField(options, options.file);
                if (typeof mml === 'string') {
                    mml = JSON.parse(mml);
                }
            }
            that._resolveMmlConfiguration(options, mml);
            return new Promise(function(resolve, reject) {
                millstone.resolve({
                    mml : mml,
                    base : options.dir || that.options.baseDir,
                    cache : that._tmpDir
                }, function(err, resolved) {
                    options.mml = resolved;
                    if (err)
                        return reject(err);
                    else
                        return resolve(options);
                });
            });
        });
    },

    _resolveMmlConfiguration : function(options, mml) {
        if (typeof this.options.resolveConfiguration == 'function') {
            this.options.resolveConfiguration.call(this, options, mml);
        } else {
            this._resolveStylesheets(options, mml);
            this._resolveLayers(options, mml);
        }
    },

    _resolveLayers : function(options, mml) {
        mml.Layer = this._resolveValue(mml.Layer, mml, options, []);
        mml.Layer.forEach(function(layer) {
            this._resolveLayerDatasource.call(this, options, mml, layer);
        }, this);
    },

    _resolveLayerDatasource : function(options, mml, layer) {
        var datasource = layer.Datasource = layer.Datasource || {};
        datasource.type = datasource.type || undefined;
        if (datasource.type === 'geojson' && datasource.file
                && (datasource.file + '').match(/\.js$/)) {
            datasource.file = this._resolveField(options, datasource.file,
                    layer);
        }
    },

    _resolveStylesheets : function(options, mml) {
        var stylesheets = [];
        mml.Stylesheet = this._resolveValue(mml.Stylesheet, mml, options, []);
        mml.Stylesheet.forEach(function(stylesheet) {
            var id = typeof stylesheet === 'string' ? stylesheet : this
                    ._newId();
            stylesheet = this._resolveField(options, stylesheet, mml);
            stylesheet = this._checkStylesheet(stylesheet);
            if (stylesheet) {
                stylesheets.push({
                    id : id,
                    data : stylesheet
                })
            }
        }, this);
        mml.Stylesheet = stylesheets;
    },

    _checkStylesheet : function(style) {
        if (!style)
            return;
        if (typeof style === 'string')
            return style;
        if (!this.serializer) {
            this.serializer = new CartoCssSerializer();
        }
        var result = this.serializer.serialize(style);
        return result;
    },

    _newId : function() {
        MapnikConfigLoader._idCounter = (MapnikConfigLoader._idCounter || 0) + 1;
        return 'id-' + MapnikConfigLoader._idCounter;
    },

    _resolveField : function(options, value, context) {
        if (typeof value === 'string') {
            var filePath = path.resolve(options.dir, value);
            if (filePath.match(/\.js$/)) {
                value = this._loadScript(filePath);
            } else {
                value = fs.readFileSync(filePath, 'UTF-8');
            }
        }
        value = this._resolveValue(value, context, options, {});
        return value;
    },

    _resolveValue : function(value, context, options, defaultValue) {
        if (typeof value === 'function') {
            context = context || options;
            options = extend({}, this.options, options);
            value = value.call(context, options);
        }
        return value || defaultValue;
    },

    _loadScript : function(filePath) {
        try {
            delete require.cache[path.resolve(filePath)];
            return require(filePath);
        } catch (err) {
            throw err;
        }
    },

    _resolveMmlFile : function(options) {
        if (!options.dir && options.file) {
            options.dir = path.dirname(options.file);
        }
        options.dir = options.dir || this.options.baseDir || '';
        if (!options.file) {
            var file = path.resolve(options.dir, 'project.js');
            if (!fs.existsSync(file)) {
                file = path.resolve(options.dir, 'project.mml');
            }
            options.file = file;
        }
    },
}

module.exports = MapnikConfigLoader;
