var VectorTilesToImage = require('../tiles/VectorTilesToImage');
var DispatchingTilesProvider = require('../tiles/DispatchingTilesProvider');
var VectorTilesToUtfGrid = require('../tiles/VectorTilesToUtfGrid');
var VectorTilesSerializer = require('../tiles/VectorTilesSerializer');
var VectorTilesGenerator = require('../tiles/VectorTilesGenerator');
var CompositeTilesProvider = require('../tiles/CompositeTilesProvider');
var RendererLoader = require('../renderer/RendererLoader');
var Utils = require('../Utils');
var extend = Utils.extend;

function TilesHandler(options) {
    this.initialize(options);
}
extend(TilesHandler.prototype, {

    initialize : function(options) {
        this.options = options || {};
        this._provider = this._newTilesProvider();
    },

    _getRendererLoader : function() {
        return this.options.loader || new RendererLoader(this.options);
    },

    _newTilesProvider : function() {
        var options = extend({}, this.options, {
            loader : this._getRendererLoader()
        });
        var imageGenerator = new VectorTilesToImage(options);
        var utfGridGenerator = new VectorTilesToUtfGrid(options);
        return new CompositeTilesProvider([ //
        this._newVectorTilesProvider(), //
        new DispatchingTilesProvider({
            'pbf' : new VectorTilesSerializer(options),
            'png' : imageGenerator,
            'utf.json' : utfGridGenerator,
            'utf.jsonp' : utfGridGenerator,
        }) ]);
    },

    _newVectorTilesProvider : function() {
        var options = extend({}, this.options, {
            loader : this._getRendererLoader()
        });
        return new VectorTilesGenerator(options);
    },

    handle : function(req, res, next) {
        var that = this;
        return Promise.resolve()//
        .then(function() {
            var query = req.query || {};
            var params = req.params;
            params.z = +params.z;
            params.x = +params.x;
            params.y = +params.y;
            params.format = params.format || params.type || 'png';
            delete params.type;
            var options = {
                params : params,
                query : query
            };
            return that._provider.loadTile(options);
        }).then(function(result) {
            res.set(result.headers);
            res.send(result.tile);
        }, function(err) {
            res.status(500).send({
                message : err.message,
                stack : err.stack
            });
        });
    }
});

module.exports = TilesHandler;
