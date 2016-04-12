var fs = require('fs');
var expect = require('expect.js');
var DispatchingTilesProvider = require('../../lib/providers/DispatchingTilesProvider');
var Utils = require('../../lib/Utils');
var extend = Utils.extend;
var TestUtils = require('../TestUtils');

describe('DispatchingTilesProviderTest', function() {

    function f(msg) {
        return {
            loadTile : function(options) {
                return extend({}, options, {
                    tile : msg
                });
            }
        };
    }
    var provider = new DispatchingTilesProvider({
        providers : {
            'pbf' : f('pbf vector'),
            'png' : f('png image'),
            'json' : f('utf grid'),
            'utf' : f('utf grid')
        }
    });
    function test(msg, format, tile) {
        return TestUtils.runTest(msg, function() {
            return provider.loadTile({
                params : {
                    format : format
                },
            }).then(function(result) {
                expect(result).to.eql({
                    params : {
                        format : format
                    },
                    tile : tile
                });
            });
        });
    }
    test('should call right external providers '
            + 'based on requested tile types', 'utf', 'utf grid');
    test('should call right external providers '
            + 'based on requested tile types', 'png', 'png image');

    TestUtils.runTest('should throw an exception ' + //
    'for unknown formats', function() {
        return provider.loadTile({
            params : {
                format : 'foobar'
            },
        }).then(function(result) {
            throw new Error();
        }, function(err) {
            expect(err.message).to.eql('No providers ' + // 
            'were found for the "foobar" format.')
        });
    });
});
