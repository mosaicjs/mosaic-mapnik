var fs = require('fs');
var expect = require('expect.js');
var SphericalMercator = require('sphericalmercator');
var MapnikConfigLoader = require('../lib/MapnikConfigLoader');
var MapnikRenderer = require('../lib/MapnikRenderer');
var TestUtils = require('./TestUtils');

describe('MapnikRenderer', function() {
    TestUtils.runTest('generates map tiles', function() {
        var projectDir = TestUtils.getPath('project3');
        var sourceProject = projectDir + '/source';
        var styleProject = projectDir + '/style';
        function test(source, renderer, format) {
            var params = {
                x : 16,
                y : 11,
                z : 5,
            };
            return source.buildVectorTile(params)//
            .then(function(info) {
                var vtile = info.vtile;
                var layers = vtile.names();
                var json = vtile.toJSON();
                info.format = format;
                info.layer = layers[0];
                info.fields = [ 'ADM0_A3', 'NAME' ];
                return renderer.renderVectorTile(info)//
                .then(function(buffer) {
                    if (!(buffer instanceof Buffer)) {
                        var str = JSON.stringify(buffer, null, 2);
                        buffer = new Buffer(str, 'UTF-8');
                    }
                    var suffix = [ vtile.z, vtile.x, vtile.y ];
                    suffix = suffix.join('-');
                    var file = '/tile-' + suffix + '.' + format;
                    var control = fs.readFileSync(projectDir + file);
                    // fs.writeFileSync(__dirname + file, buffer);
                    expect(buffer.toString('base64'))//
                    .to.eql(control.toString('base64'));
                });
            });
        }
        return Promise.all([ //
        loadRenderer(sourceProject), //
        loadRenderer(styleProject) //
        ])//
        .then(function(array) {
            var source = array[0];
            var renderer = array[1];
            return Promise.all([ 'png', 'utf' ].map(function(format) {
                return test(source, renderer, format);
            }));
        });
    });
    TestUtils.runTest('generates full map directly in files', function() {
        var projectDir = TestUtils.getPath('project3');
        var loader = new MapnikConfigLoader();
        return loader.readProjects({}, [ {
            dir : projectDir + '/style'
        }, {
            dir : projectDir + '/source'
        } ]).then(function(params) {
            var renderer = new MapnikRenderer({
                xml : params.xml
            });
            var mercator = new SphericalMercator();
            var bbox = mercator.bbox(0, 0, 0);
            return renderer.render({
                bbox : bbox,
                zoom : 2,
                format : 'pdf', // 'pdf', 'svg', 'png'
                dir : projectDir + '/tmp'
            }).then(function(result) {
                var control = fs.readFileSync(projectDir + '/map.pdf');
                expect(result.buffer.toString('base64')).//
                to.eql(control.toString('base64'));
            });
        });
    });
});

function loadRenderer(dir) {
    var loader = new MapnikConfigLoader();
    return loader.readProject({
        dir : dir
    }).then(function(params) {
        var renderer = new MapnikRenderer({
            xml : params.xml,
            tileSize : 512
        });
        return renderer;
    });
}