var MapnikRendererPool = require('../renderer/MapnikRendererPool');
var TilesProvider = require('./TilesProvider');
var VectorTilesGenerator = require('./VectorTilesGenerator');
var util = require('util');
var path = require('path');
var fs = require('fs');

function loadTemplate(fileName) {
    var sql = fs.readFileSync(path.resolve(__dirname, fileName), 'UTF8');
    return function(m){
        return sql.replace(/\$\{(.*?)\}/gim, function(full, val) {
            return m(val || '') || '';
        });
    }
}
var CONFIG_TEMPLATE = loadTemplate('./DynamicTilesProvider.xml');

/**
 * This tiles provider allows dynamically generate Mapnik configuration files
 * using provided SQL queries. Generated MapnikRenderer instances are store in
 * an internal pool, where the serialized query is used as a key. This class
 * requires two mandatory parameters required to dynamically generate SQL
 * queries: 1) cacheId 2) buildSql. Both methods accepts the "options" parameter
 * of the "loadTile" method.
 * 
 * @param options.cacheId
 *            a mandatory method returning a string key used to cache
 *            MapRenderer instances; it calculates this cache ID based on the
 *            "options" parameter of the "loadTile" method
 * @param options.buildSql
 *            a mandatory method used to dynamically build SQL queries
 */
function DynamicTilesProvider(options) {
    var that = this;
    that.options = options || {};
    that.provider = new VectorTilesGenerator(that.options);
    var pool = that.pool = new MapnikRendererPool(options);
    pool._readProjectConfig = function(key, options) {
        return Promise.resolve().then(function() {
            var sql = that._buildSqlQuery(options);
            sql = '(' + sql + ') as data';
            var collection = options.params.collection;
            var queryConfig = {
                sql : sql,
                layer : collection,
                geometry : 'geometry',
                "srs" : "+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs",
                bufferSize : that.options.bufferSize || 128
            };
            var xml = CONFIG_TEMPLATE(function(key) {
                return that.options.db[key] || queryConfig[key] || '';
            });
            return {
                xml : xml
            }
        });
    };
}
util.inherits(DynamicTilesProvider, TilesProvider);

DynamicTilesProvider.prototype.loadTile = function(options) {
    var that = this;
    return Promise.resolve().then(function() {
        var cacheId = that.options.cacheId(options);
        return that.pool.withRenderer(cacheId, function(source) {
            return source.buildVectorTile(options.params) //
            .then(function(info) {
                var result = {};
                for ( var key in options) {
                    result[key] = options[key];
                }
                result.tile = info.vtile;
                result.headers = {
                    'Content-Type' : 'application/x-mapnik-vector-tile'
                };
                return result;
            });
        }, options);
    })
}

DynamicTilesProvider.prototype._buildSqlQuery = function(options) {
    return this.options.buildSql.call(this, options);
}

module.exports = DynamicTilesProvider;
