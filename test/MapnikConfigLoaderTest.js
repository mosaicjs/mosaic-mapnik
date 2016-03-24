var fs = require('fs');
var expect = require('expect.js');
var MapnikConfigLoader = require('../lib/MapnikConfigLoader');
var TestUtils = require('./TestUtils');

describe('MapnikConfigLoader', function() {

    describe('generates Mapnik XML', function() {
        var paths = [ 'project1', 'project2' ].map(TestUtils.getPath);

        TestUtils.runTest('from MSS objects', function() {
            return Promise.all(paths.map(function(dir) {
                return Promise.resolve().then(function() {
                    var mml = TestUtils.readJson(dir + '/project.mml');
                    var xml = readProjectXml(dir);
                    var loader = new MapnikConfigLoader();
                    return loader.readProject({
                        mml : mml,
                        dir : dir
                    }).then(function(result) {
                        expect(result.xml).to.eql(xml);
                    });
                }).then(null, function(err) {
                    console.log('ERROR[' + dir + ']', err, err.stack);
                    throw err;
                });
            }));
        });

        TestUtils.runTest('from project files', function() {
            return Promise.all(paths.map(function(dir) {
                return Promise.resolve().then(function() {
                    var xml = readProjectXml(dir);
                    var loader = new MapnikConfigLoader();
                    return loader.readProject({
                        file : dir + '/project.mml'
                    }).then(function(result) {
                        expect(result.xml).to.eql(xml);
                    });
                }).then(null, function(err) {
                    console.log('ERROR[' + dir + ']', err.stack);
                    throw err;
                });
            }));
        });

        TestUtils.runTest('from script project files', function() {
            return Promise.all(paths.map(function(dir) {
                return Promise.resolve().then(function() {
                    var xml = readProjectXml(dir);
                    var loader = new MapnikConfigLoader();
                    return loader.readProject({
                        file : dir + '/project.js'
                    }).then(function(result) {
                        expect(result.xml).to.eql(xml);
                    });
                }).then(null, function(err) {
                    console.log('ERROR[' + dir + ']', err.stack);
                    throw err;
                });
            }));
        });

        TestUtils.runTest('from project directory', function() {
            return Promise.all(paths.map(function(dir) {
                return Promise.resolve().then(function() {
                    var xml = readProjectXml(dir);
                    var loader = new MapnikConfigLoader();
                    return loader.readProject({
                        dir : dir
                    }).then(function(result) {
                        expect(result.xml).to.eql(xml);
                    });
                }).then(null, function(err) {
                    console.log('ERROR[' + dir + ']', err.stack);
                    throw err;
                });
            }));
        });
    });

});

function readProjectXml(dir) {
    var xml = TestUtils.readFile(dir + '/project.xml');
    xml = xml.replace('./data.geo.json', dir + '/data.geo.json');
   return xml;
}