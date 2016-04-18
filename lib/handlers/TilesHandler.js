var TilesGenerator = require('../tiles/TilesGenerator');
var Utils = require('../Utils');
var extend = Utils.extend;

function TilesHandler(options) {
    this.initialize(options);
}
extend(TilesHandler.prototype, {

    initialize : function(options) {
        this.options = options || {};
        this._provider = new TilesGenerator(this.options);
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
