var fs = require('fs');
var crypto = require('crypto');
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
        return Promise.resolve().then(function() {
            return that._loadTilesource(options)//
            .then(function(tilesource) {
                return that._loadFromTilesource(tilesource, options);
            });
        });
    },

    _storeToCache : function(options, result) {
        var that = this;
        return Promise.resolve().then(function() {
            return that._loadTilesource(options)//
            .then(function(tilesource) {
                return that._storeToTilesource(tilesource, options, result);
            });
        });
    },

    _loadTilesource : function(options) {
        var that = this;
        var dir;
        return Promise.resolve().then(function() {
            dir = that.options.cacheDir;
            var indexes = that._dirIndexes = that._dirIndexes || {};
            if (!indexes[dir]) {
                function noop() {
                }
                indexes[dir] = createDir(dir.split('/'));
            }
            return indexes[dir];
        }).then(function() {
            var fileName = that._getDbFileName(options.cacheId);
            return that._loadMbtiles(fileName, options);
        });
        function createDir(segments) {
            return Promise.resolve().then(function() {
                if (!segments.length)
                    return false;
                var path = segments.join('/');
                return ninvoke(fs, 'stat', path)//
                .then(function(stat) {
                    return stat.isDirectory();
                }, function(err) {
                    if (err.code !== 'ENOENT')
                        throw err;
                    var parentSegments = segments.slice(0, //
                    segments.length - 1);
                    return createDir(parentSegments).then(function() {
                        return ninvoke(fs, 'mkdir', path)//
                        .then(null, function(err) {
                            if (err.code === 'EEXIST')
                                return true;
                            throw err;
                        });
                    });
                });
            });
        }
    },

    _getDbFileName : function(cacheId) {
        cacheId = cacheId || '';
        var shasum = crypto.createHash('sha1');
        shasum.update(cacheId);
        var hash = shasum.digest('hex');
        var fileName = dir + '/cache[' + hash + '].mbtiles';
    }

});

module.exports = MbtilesCachingTilesProvider;