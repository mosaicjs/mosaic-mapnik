var fs = require('fs');
var CachingTilesProvider = require('./CachingTilesProvider');
var Utils = require('../../Utils');
var extend = Utils.extend;
var ninvoke = Utils.ninvoke;

function TileSourceUtils(options) {
    this.initialize(options);
}

extend(TileSourceUtils.prototype, {

    _loadFromTilesource : function(tilesource, options) {
        var that = this;
        return Promise.resolve().then(function() {
            var params = options.params || {};
            var z = +params.z, x = +params.x, y = +params.y;
            return new Promise(function(resolve, reject) {
                try {
                    tilesource.getTile(z, x, y, function(err, tile, headers) {
                        if (err) {
                            if (that._tileDoesNotExist(err)) {
                                return resolve();
                            } else {
                                return reject(err);
                            }
                        } else
                            return resolve(extend({}, options, {
                                tile : tile,
                                headers : headers
                            }));
                    });
                } catch (err) {
                    return reject(err);
                }
            });
        });
    },

    _storeToTilesource : function(tilesource, options, result) {
        var that = this;
        return Promise.resolve().then(function() {
            if (!tilesource.writePromise) {
                tilesource.writePromise = Promise.resolve();
            }
            var promise = tilesource.writePromise.then(function() {
                return ninvoke(tilesource, 'startWriting');
            }).then(function() {
                var params = options.params || {};
                var z = +params.z, x = +params.x, y = +params.y;
                var buffer = result.tile;
                if (!(buffer instanceof Buffer)) {
                    buffer = new Buffer(JSON.stringify(result.tile), 'UTF-8');
                }
                return ninvoke(tilesource, 'putTile', z, x, y, buffer);
            }).then(function(result) {
                return ninvoke(tilesource, 'stopWriting').then(function() {
                    return result;
                });
            }, function(err) {
                return ninvoke(tilesource, 'stopWriting').then(function() {
                    throw err;
                });
            });
            var noop = function() {
            };
            tilesource.writePromise = promise.then(noop, noop);
            return promise;
        });
    },

    _tileDoesNotExist : function(err) {
        return (err.message === 'Tile does not exist');
    },

    _loadMbtiles : function(fileName, options) {
        var that = this;
        var index = that._index = that._index || {};
        return index[fileName] = index[fileName] || Promise.resolve()// 
        .then(function() {
            return new Promise(function(resolve, reject) {
                try {
                    var MBTiles = require('mbtiles');
                    return new MBTiles({
                        pathname : fileName
                    }, function(err, mbtiles) {
                        if (err)
                            return reject(err);
                        else
                            resolve(mbtiles);
                    });
                } catch (err) {
                    return reject(err);
                }
            })
        });
    }

});

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
        return Promise.resolve().then(function() {
            var dir = that.options.cacheDir;
            try {
                fs.mkdirSync(dir);
            } catch (err) {
                // do nothing
            }
            var cacheId = that._cacheId(options);
            var fileName = dir + '/cache.' + cacheId + '.mbtiles';
            return that._loadMbtiles(fileName, options);
        });
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