var Mosaic = require('mosaic-commons');
var MapnikConfigLoader = require('./MapnikConfigLoader');
var MapnikRenderer = require('./MapnikRenderer');
var Path = require('path');
var FS = require('fs');
var _ = require('underscore');

var TileService = Mosaic.Class.extend({

    initialize : function(options) {
        this.setOptions(options);
    },

    tile : rest('/*source/:z/:x/:y/tile.:format', 'GET', function(options) {
        var that = this;
        options = options || {};
        var sourceKey = options.source;
        return that._loadRenderer(sourceKey).then(function(renderer) {
            var format = options.format || 'png';
            if (format == 'grid.json') {
                format = 'utf';
            }
            var zoom = +options.z;
            var x = +options.x;
            var y = +options.y;
            var config = renderer.options.config;
            var interactivity = config.interactivity || {};
            interactivity.fields = '' + (interactivity.fields || '');
            interactivity.fields = _.isString(interactivity.fields) ? //
            interactivity.fields.split(',') : _.toArray(interactivity.fields);
            return renderer.exec(function(r) {
                var params = {
                    sourceKey : sourceKey,
                    format : format,
                    z : zoom,
                    x : x,
                    y : y,
                    layer : interactivity.layer,
                    fields : interactivity.fields,
                };
                return that._renderVectorTile(r, params);
            });
        });
    }),

    _loadVectorTile : function(r, params) {
        var that = this;
        var key = params.sourceKey + '-' + params.z + '-' + params.x + '-' +
                params.y;
        var promise = that._tilesCache[key];
        if (!promise) {
            var tmpDir = that._getTmpDir(params.sourceKey);
            var fileName = key + '.vtile';
            var file = Path.join(tmpDir, fileName);
            if (FS.existsSync(file)) {
                // Load already an existing vector tile from the file
                promise = Mosaic.P.ninvoke(FS, FS.readFile, file)//
                .then(function(data) {
                    return r.loadVectorTile(data, params);
                });
            } else {
                // Builds a new vector tile and store it in a file
                promise = r.buildVectorTile(params).then(function(params) {
                    var vtile = params.vtile;
                    var data = vtile.getData();
                    return Mosaic.P.ninvoke(FS, FS.writeFile, file, data)//
                    .then(function() {
                        return params;
                    });
                });
            }
            that._tilesCache[key] = promise;
        }
        return promise;
    },

    _renderVectorTile : function(r, params) {
        var that = this;
        if (!that._tilesCache) {
            that._tilesCache = {};
        }
        return that._loadVectorTile(r, params).then(function(params) {
            return r.renderVectorTile(params);
        });

    },

    _loadRenderer : function(sourceKey) {
        var that = this;
        that._renderers = that._renderers || {};
        return Mosaic.P.then(function() {
            var promise = that._renderers[sourceKey];
            if (!promise) {
                promise = that._newRenderer(sourceKey);
                that._renderers[sourceKey] = promise;
            }
            return promise;
        });
    },

    _getTmpDir : function(sourceKey) {
        var that = this;
        if (!that._tmpDirList) {
            that._tmpDirList = {};
        }
        var tmpDir = that._tmpDirList[sourceKey];
        if (!tmpDir) {
            tmpDir = that.options.tmpDir;
            if (!tmpDir) {
                var projectDir = that._getProjectDir(sourceKey);
                tmpDir = Path.join(projectDir, 'tmp');
            }
            if (!FS.existsSync(tmpDir)) {
                FS.mkdirSync(tmpDir);
            }
            that._tmpDirList[sourceKey] = tmpDir;
        }
        return tmpDir;
    },

    _newRenderer : function(sourceKey) {
        var that = this;
        var projectDir = that._getProjectDir(sourceKey);
        var mml = that._loadProjectFile(projectDir, sourceKey);
        var loader = that._getMapnikConfigLoader(sourceKey);
        return loader.loadMssFromMml(projectDir, mml).then(function(options) {
            options.tmpDir = that._getTmpDir(options);
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
