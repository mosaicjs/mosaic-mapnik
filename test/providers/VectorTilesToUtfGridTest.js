var fs = require('fs');
var expect = require('expect.js');
var mapnik = require('mapnik');
var VectorTilesGenerator = require('../../lib/providers/VectorTilesGenerator');
var VectorTilesToImage = require('../../lib/providers/VectorTilesToImage');
var VectorTilesToUtfGrid = require('../../lib/providers/VectorTilesToUtfGrid');
var RendererLoader = require('../../lib/RendererLoader');
var TestUtils = require('../TestUtils');

describe('MapnikRenderer', function() {
    function testUtfGrid(msg, options) {
        return TestUtils.runTest(msg, function() {

            var projectDir = TestUtils.getPath('project3');
            var vtOptions = {
                loader : new RendererLoader({
                    baseDir : projectDir,
                    tileSize : 512
                })
            };
            var generator = new VectorTilesGenerator(vtOptions);
            var renderer = new VectorTilesToUtfGrid(vtOptions);
            return generator.loadTile(options).then(function(result) {
                expect(result.params).to.eql(options.params);
                expect(result.tile instanceof mapnik.VectorTile).to.be(true);
                expect(result.headers).to.eql({
                    'Content-Type' : 'application/x-mapnik-vector-tile'
                });
                return result;
            }).then(function(result) {
                return renderer.loadTile(result).then(function(result) {
                    expect(result.params).to.eql(options.params);
                    var q = options.expectedQuery || options.query;
                    expect(result.query).to.eql(q);
                    expect(result.headers).to.eql(options.headers);
                    var str = result.tile;
                    if (typeof result.tile !== 'string') {
                        expect(typeof result.tile).to.be('object');
                        str = JSON.stringify(str, null, 2);
                    }
                    var params = options.params;
                    var suffix = [ params.z, params.x, params.y ].join('-');
                    var file = '/tile-' + suffix + '.' + params.format;
                    var control = fs.readFileSync(projectDir + file, 'UTF-8');
                    if (typeof options.control === 'function') {
                        control = options.control(control);
                    }
                    expect(str).to.eql(control);
                });
            });
        });
    }

    testUtfGrid('use deserialized fields', {
        params : {
            x : 16,
            y : 11,
            z : 5,
            format : 'utf',
        },
        query : {
            layers : [ {
                layer : 'basemap',
                fields : [ 'ADM0_A3', 'NAME' ]
            } ]
        },
        headers : {
            'Content-Type' : 'application/json'
        }
    });

    testUtfGrid('use serialized fields (serialized as string)', {
        params : {
            x : 16,
            y : 11,
            z : 5,
            format : 'utf',
        },
        query : {
            layers : [ {
                layer : 'basemap',
                fields : 'ADM0_A3,NAME'
            } ]
        },
        expectedQuery : {
            layers : [ {
                layer : 'basemap',
                fields : [ 'ADM0_A3', 'NAME' ]
            } ]
        },
        headers : {
            'Content-Type' : 'application/json'
        }
    });

    testUtfGrid('layer and the corresponing fields are serialized', {
        params : {
            x : 16,
            y : 11,
            z : 5,
            format : 'utf',
        },
        query : {
            layers : 'basemap:ADM0_A3,NAME'
        },
        expectedQuery : {
            layers : [ {
                layer : 'basemap',
                fields : [ 'ADM0_A3', 'NAME' ]
            } ]
        },
        headers : {
            'Content-Type' : 'application/json'
        }
    });

    testUtfGrid('test UTF grid with callback methods', {
        params : {
            x : 16,
            y : 11,
            z : 5,
            format : 'utf',
        },
        query : {
            layers : 'basemap:ADM0_A3,NAME',
            cb : 'foobar'
        },
        control : function(c) {
            return 'foobar(' + c + ')';
        },
        expectedQuery : {
            layers : [ {
                layer : 'basemap',
                fields : [ 'ADM0_A3', 'NAME' ]
            } ],
            cb : 'foobar'
        },
        headers : {
            'Content-Type' : 'application/javascript'
        }
    });

});
