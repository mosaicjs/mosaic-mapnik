var fs = require('fs');
var CachingTilesProvider = require('./CachingTilesProvider');
var TileSourceUtils = require('./TileSourceUtils');
var Utils = require('../../Utils');
var extend = Utils.extend;
var ninvoke = Utils.ninvoke;

function MbtilesCachingTilesProvider(options) {
    this.initialize(options);
}
extend(//
MbtilesCachingTilesProvider.prototype, //
TileSourceUtils.prototype, //
CachingTilesProvider.prototype, {

    _loadFromCache : function(options) {
        var that = this;
        return that._loadTilesource(options).then(function(tilesource) {
            return that._loadFromTilesource(tilesource, options);
        });
    },

    _storeToCache : function(options, result) {
        var that = this;
        return that._loadTilesource(options).then(function(tilesource) {
            return that._storeToTilesource(tilesource, options, result);
        });
    },

    _loadTilesource : function(options) {
        var that = this;
        var dir;
        return Promise.resolve().then(function() {
            dir = that.options.cacheDir;
            var indexes = that._dirIndexes = that._dirIndexes || {};  
            return indexes[dir] = indexes[dir] || createDir(dir.split('/'));
        }).then(function() {
            var cacheId = that._cacheId(options);
            var fileName = dir + '/cache.' + cacheId + '.mbtiles';
            return that._loadMbtiles(fileName, options);
        });
        function createDir(segments) {
            return Promise.resolve().then(function() {
                if (!segments.length)
                    return false;
                var path = segments.join('/');
                return ninvoke(fs, 'stat', path).then(function(stat) {
                    return stat.isDirectory();
                }, function(err) {
                    if (err.code !== 'ENOENT')
                        throw err;
                    var parentSegments = segments.slice(0, segments.length - 1);
                    return createDir(parentSegments).then(function() {
                        return ninvoke(fs, 'mkdir', path);
                    });
                });
            });
        }
    },

    _cacheId : function(options) {
        var cacheId = this.options.cacheId;
        if (cacheId) {
            if (typeof cacheId === 'function') {
                cacheId = cacheId(options);
            }
        } else {
            cacheId = options.params.format || 'png';
        }
        return cacheId;
    },

});

module.exports = MbtilesCachingTilesProvider;