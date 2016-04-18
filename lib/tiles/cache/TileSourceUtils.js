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
            }).then(function(result) {
                if (!result)
                    return;
                return that._getTilesourceInfo(tilesource).then(function(info) {
                    info = info || {};
                    var headers = extend({}, result.headers, {
                        'Content-Type' : info.contentType
                    });
                    return extend({}, result, {
                        headers : headers
                    });
                });
            });
        });
    },

    _storeToTilesource : function(tilesource, options, result) {
        var that = this;
        return Promise.resolve().then(function() {
            if (!result)
                return;
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
                    var str;
                    if (typeof result.tile === 'string') {
                        str = result.tile;
                    } else {
                        str = JSON.stringify(result.tile, null, 2);
                    }
                    buffer = new Buffer(str || '', 'UTF-8');
                }
                return ninvoke(tilesource, 'putTile', z, x, y, buffer);
            }).then(function() {
                if (!result)
                    return result;
                return that._getTilesourceInfo(tilesource).then(function(info) {
                    info = info || {};
                    if (!info.contentType) {
                        info.contentType = result.headers['Content-Type'];
                        return that._setTilesourceInfo(tilesource, info) //
                        .then(function() {
                            return result;
                        });
                    }
                    return result;
                })
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

    _getTilesourceInfo : function(tilesource) {
        return Promise.resolve().then(function() {
            if (tilesource.__info)
                return tilesource.__info;
            return ninvoke(tilesource, 'getInfo').then(function(info) {
                tilesource.__info = info;
                return info;
            });
        });
    },

    _setTilesourceInfo : function(tilesource, info) {
        return Promise.resolve().then(function() {
            tilesource.__info = info;
            return ninvoke(tilesource, 'putInfo', info);
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

module.exports = TileSourceUtils;