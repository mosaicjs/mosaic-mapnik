var fs = require('fs');
var expect = require('expect.js');
var pack = require('../..');
var GeoJsonToPbf = pack.tiles.GeoJsonToPbf;
var VectorTilesToImage = pack.tiles.VectorTilesToImage;
var VectorTilesDeserializer = pack.tiles.VectorTilesDeserializer;
var RendererLoader = pack.loader.RendererLoader;
var MapnikConfigLoader = pack.loader.MapnikConfigLoader;
var MapnikRenderer = pack.renderer.MapnikRenderer;
var Utils = pack.Utils;
var extend = Utils.extend;
var TestUtils = require('../TestUtils');

describe('GeoJsonToPbfTest', function() {

    TestUtils.runTest('generates image map tiles', function() {
        var projectDir = TestUtils.getPath('project3');
        // var toVectorTile = new VectorTilesDeserializer();
        // var renderer = new VectorTilesToImage({
        // loader : new RendererLoader({
        // baseDir : projectDir,
        // tileSize : 512
        // })
        // });

        return Promise.resolve()//
        .then(function() {
            var loader = new MapnikConfigLoader();
            return loader.readProject({
                dir : projectDir + '/style'
            });
        }).then(function(params) {
            var renderer = new MapnikRenderer({
                xml : params.xml,
                tileSize : 512
            });
            return renderer;
        }).then(function(renderer) {
            var dataFile = projectDir + //
            '/source/layers/basemap/world.geo.json';
            var source = new GeoJsonToPbf({
                data : {
                    'basemap' : dataFile
                }
            });
            var options = {
                params : {
                    x : 0,
                    y : 0,
                    z : 0,
                    format : 'png'
                }
            };
            return Promise.resolve().then(function() {
                return source.loadTile(options);
            }).then(function(result) {
                return renderer.loadVectorTile(result.tile, options.params)//
            }).then(function(res) {
                return renderer.renderVectorTile(res);
            }).then(function(tile) {
                // var control = fs.readFileSync(projectDir + '/map.pdf');
                // var params = options.params;
                // var suffix = [ params.z, params.x, params.y ].join('-');
                // var file = '/tile-' + suffix + '.png';
                // fs.writeFileSync(__dirname + file, tile);
                //
                // expect(tile.toString('base64')).//
                // to.eql(control.toString('base64'));
            });
        });
    });

});
