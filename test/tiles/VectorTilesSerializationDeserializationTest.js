var fs = require('fs');
var expect = require('expect.js');
var mapnik = require('mapnik');
var pack = require('../..');
var VectorTilesGenerator = pack.tiles.VectorTilesGenerator;
var VectorTilesToImage = pack.tiles.VectorTilesToImage;
var VectorTilesSerializer = pack.tiles.VectorTilesSerializer;
var VectorTilesDeserializer = pack.tiles.VectorTilesDeserializer;
var RendererLoader = pack.renderer.RendererLoader;
var TestUtils = require('../TestUtils');

describe('VectorTilesToImageTest', function() {
    TestUtils.runTest('generates image map tiles', function() {
        var projectDir = TestUtils.getPath('project3');
        var vtOptions = {
            loader : new RendererLoader({
                baseDir : projectDir,
                tileSize : 512
            })
        };
        var generator = new VectorTilesGenerator(vtOptions);
        var renderer = new VectorTilesToImage(vtOptions);
        var serializer = new VectorTilesSerializer();
        var deserializer = new VectorTilesDeserializer();
        var params = {
            x : 16,
            y : 11,
            z : 5,
        };
        return generator.loadTile({
            params : params
        }).then(function(result) {
            expect(result.params).to.eql(params);
            expect(result.tile instanceof mapnik.VectorTile).to.be(true);
            expect(result.headers).to.eql({
                'Content-Type' : 'application/x-mapnik-vector-tile'
            });
            return serializer.loadTile(result);
        }).then(function(result) {
            expect(result.params).to.eql(params);
            expect(result.tile instanceof Buffer).to.be(true);
            expect(result.headers).to.eql({
                'Content-Type' : 'application/x-protobuf'
            });
            return deserializer.loadTile(result);
        }).then(function(result) {
            expect(result.params).to.eql(params);
            expect(result.tile instanceof mapnik.VectorTile).to.be(true);
            expect(result.headers).to.eql({
                'Content-Type' : 'application/x-mapnik-vector-tile'
            });
            return renderer.loadTile(result);
        }).then(function(result) {
            expect(result.params).to.eql(params);
            expect(result.tile instanceof Buffer).to.be(true);
            expect(result.headers).to.eql({
                'Content-Type' : 'image/png'
            });
            var suffix = [ params.z, params.x, params.y ].join('-');
            var file = '/tile-' + suffix + '.png';
            var control = fs.readFileSync(projectDir + file);
            expect(result.tile.toString('base64'))//
            .to.eql(control.toString('base64'));
        });
    });

});
