var expect = require('expect.js');
var parseLayersInfo = require('../../lib/providers/parseLayersInfo');
describe('ParseLayerInfoTest', function() {

    function test(input, control) {
        expect(parseLayersInfo(input)).to.eql(control);
    }

    it('should be able to parse string-serialized layers info', function() {
        test('foobar', [ {
            layer : 'foobar',
            fields : []
        } ]);
        test('foobar:field1,field2,field3', [ {
            layer : 'foobar',
            fields : [ 'field1', 'field2', 'field3' ]
        } ]);
        test('layer1:field1,field2,field3;layer2:field4,field5,field6', [ {
            layer : 'layer1',
            fields : [ 'field1', 'field2', 'field3' ]
        }, {
            layer : 'layer2',
            fields : [ 'field4', 'field5', 'field6' ]
        } ]);
    });

    it('should keep already parsed layers info objects', function() {
        test([ {
            layer : 'foobar',
            fields : [ 'field1', 'field2', 'field3' ]
        } ], [ {
            layer : 'foobar',
            fields : [ 'field1', 'field2', 'field3' ]
        } ]);

        test([ {
            layer : 'foobar',
            fields : 'field1,field2,field3'
        } ], [ {
            layer : 'foobar',
            fields : [ 'field1', 'field2', 'field3' ]
        } ]);

        test({
            layer : 'foobar',
            fields : 'field1,field2,field3'
        }, [ {
            layer : 'foobar',
            fields : [ 'field1', 'field2', 'field3' ]
        } ]);

    });
});
