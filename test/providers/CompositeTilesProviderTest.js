var fs = require('fs');
var expect = require('expect.js');
var CompositeTilesProvider = require('../../lib/providers/CompositeTilesProvider');
var Utils = require('../../lib/Utils');
var extend = Utils.extend;
var TestUtils = require('../TestUtils');

describe('CompositeTilesProvider', function() {

    function test(msg, labels) {
        function f(msg) {
            return {
                loadTile : function(options) {
                    var tile = options.tile || '';
                    if (tile)
                        tile += ' ';
                    tile += msg;
                    return extend({}, options, {
                        tile : tile
                    });
                }
            };
        }
        return TestUtils.runTest(msg, function() {
            var provider = new CompositeTilesProvider({
                providers : labels.map(f)
            });
            return provider.loadTile({}).then(function(result) {
                if (!labels.length) {
                    expect(result.tile).to.be(undefined);
                } else {
                    expect(result.tile).to.eql(labels.join(' '));
                }
            });
        });
    }
    test('should successibly call without providers', []);
    test('should call all providers in a raw', [ 'first', 'second', 'third' ]);
});
