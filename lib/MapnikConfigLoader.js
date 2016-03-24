var carto = require('carto');
var fs = require('fs');
var path = require('path');
var millstone = require('millstone');
var CartoCssSerializer = require('./CartoCssSerializer').CartoCssSerializer;

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
        this._tmpDir = this.options.tmpDir || './tmp';
        this.options.baseDir = this.options.baseDir || './';
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
            that._resolveStylesheets(options, mml);
            that._resolveLayers(options, mml);
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

    _resolveLayers : function(options, mml) {
        mml.Layer = mml.Layer || [];
        mml.Layer.forEach(function(layer) {
            this._resolveLayerDatasource(options, mml, layer);
        }, this);
    },

    _resolveLayerDatasource : function(options, mml, layer) {
        layer.Datasource = layer.Datasource || {};
        layer.Datasource.type = layer.Datasource.type || undefined;
    },

    _resolveStylesheets : function(options, mml) {
        var stylesheets = [];
        if (Array.isArray(mml.Stylesheet)) {
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
        }
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
                value = require(filePath);
            } else {
                value = fs.readFileSync(filePath, 'UTF-8');
            }
        }
        if (typeof value === 'function') {
            context = context || options;
            value = value.call(context, options);
        }
        return value;
    },

    _resolveMmlFile : function(options) {
        if (!options.dir && options.file) {
            options.dir = path.dirname(options.file);
        }
        options.dir = options.dir || this.options.baseDir || '';
        if (!options.file && options.dir) {
            options.file = path.resolve(options.dir, 'project.mml');
        }
    },
}

module.exports = MapnikConfigLoader;
