var fs = require('fs');
var expect = require('expect.js');
var GeoJsonToPbf = require('../../lib/providers/GeoJsonToPbf');
var VectorTilesToImage = require('../../lib/providers/VectorTilesToImage');
var VectorTilesDeserializer = require('../../lib/providers/VectorTilesDeserializer');
var RendererLoader = require('../../lib/RendererLoader');

var Utils = require('../../lib/Utils');
var extend = Utils.extend;
var TestUtils = require('../TestUtils');

describe('GeoJsonToPbfTest', function() {

    TestUtils.runTest('generates image map tiles', function() {
        var projectDir = TestUtils.getPath('project4');
        var source = new GeoJsonToPbf({
            data : {
                'basemap' : projectDir + '/world.geo.json'
            }
        });
        var toVectorTile = new VectorTilesDeserializer();
        var renderer = new VectorTilesToImage({
            loader : new RendererLoader({
                baseDir : projectDir,
                tileSize : 512
            })
        });

        var options = {
            params : {
                x : 16,
                y : 11,
                z : 5,
                format : 'svg'
            }
        };
        return Promise.resolve()//
        .then(function() {
            return source.loadTile(options).then(function(result) {
                expect(result.params).to.eql(options.params);
                expect(result.tile instanceof Buffer).to.be(true);
                expect(result.headers).to.eql({
                    'Content-Type' : 'application/x-protobuf'
                });
                return result;
            });
        }).then(function(result) {
            // Deserialize the buffer
            return toVectorTile.loadTile(result)//
            .then(function(options) {
                // Render the VectorTile object
                return renderer.loadTile(options);
            });
        }).then(function(result) {
            var params = options.params;
            expect(result.params).to.eql(params);
            expect(result.tile instanceof Buffer).to.be(true);
            expect(result.headers).to.eql({
                'Content-Type' : 'image/png'
            });

            var suffix = [ params.z, params.x, params.y ].join('-');
            var file = '/tile-' + suffix + '.png';
            var control = fs.readFileSync(projectDir + file);
            fs.writeFileSync(__dirname + file, result.tile);
             console.log('???', __dirname + file);
//            expect(result.tile.toString('base64'))//
//            .to.eql(control.toString('base64'));
        });
    });

});
