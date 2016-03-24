var fs = require('fs');
var expect = require('expect.js');
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
    // TestUtils.runTest('generates full map directly in files', function() {
    // var sourceProject = TestUtils.getPath('project3-source');
    // var styleProject = TestUtils.getPath('project3-style');
    // var loader = new MapnikConfigLoader();
    // return Promise.all([//
    // loader.readProject({
    // dir : sourceProject
    // }), loader.readProject({
    // dir : styleProject
    // }) ]).then(
    // function(array) {
    // var source = array[0];
    // var renderer = array[1];
    // var format = 'png';
    // var params = {
    // x : 16,
    // y : 11,
    // z : 5,
    // };
    // return source.buildVectorTile(params)
    // //
    // .then(
    // function(info) {
    // var vtile = info.vtile;
    // var layers = vtile.names();
    // var json = vtile.toJSON();
    // console.log('>>',
    // JSON.stringify(json, null, 2),
    // vtile.layers);
    // info.format = format;
    // info.layer = layers[0];
    // info.fields = [ 'ADM0_A3', 'NAME' ];
    // return renderer.renderVectorTile(info)
    // //
    // .then(
    // function(buffer) {
    // if (!(buffer instanceof Buffer)) {
    // // console.log('I
    // // AM
    // // HERE!',
    // // buffer);
    // buffer = new Buffer(JSON
    // .stringify(buffer,
    // null, 2),
    // 'UTF-8');
    // }
    // var suffix = [ vtile.z, vtile.x,
    // vtile.y ];
    // suffix = suffix.join('-');
    // var file = '/tile-' + suffix + '.'
    // + format;
    // fs.writeFileSync(__dirname + file,
    // buffer);
    // });
    // });
    // });
    // });
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