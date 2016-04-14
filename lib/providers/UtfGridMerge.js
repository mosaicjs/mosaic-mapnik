/**
 * This code was copied from here:
 * https://raw.githubusercontent.com/naturalatlas/tilestrata-utfmerge/master/blend.js
 */
//
// Copyright © 2015 Natural Atlas, Inc. & Contributors
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may not
// use this file except in compliance with the License. You may obtain a copy of
// the License at: http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
// License for the specific language governing permissions and limitations under
// the License.
//
//
module.exports = function(grids, options) {
    var result = grids[0];
    for (var i = 1; i < grids.length; i++) {
        result = merge(result, grids[i]);
    }
    return result;
};

/**
 * Merges two utfgrid objects
 * 
 * @param {object}
 *            a - original utfgrid
 * @param {object}
 *            b - utfgrid to put on top
 * @return {object}
 */
function merge(a, b) {
    var grid_c = [];
    var data_c = {};
    var keys_c = [ "" ];
    var key = 1;
    var key_mapping_a = {};
    var key_mapping_b = {};

    var dim = a.grid.length;
    for (var y = 0; y < dim; y++) {
        var row_a = a.grid[y];
        var row_b = b.grid[y];
        var row_c = [];
        for (var x = 0; x < dim; x++) {
            var id_a = decode(row_a.charCodeAt(x));
            var id_b = decode(row_b.charCodeAt(x));
            var id_c = 0;
            var key_a = a.keys[id_a];
            var key_b = b.keys[id_b];
            var key_c = 0;
            if (b.data[key_b]) {
                key_c = key_mapping_b[key_b];
                if (!key_c) {
                    key_c = (key++).toString();
                    key_mapping_b[key_b] = key_c;
                    keys_c.push(key_c);
                }
                data_c[key_c] = b.data[key_b];
                id_c = keys_c.indexOf(key_c);
            } else if (a.data[key_a]) {
                key_c = key_mapping_a[key_a];
                if (!key_c) {
                    key_c = (key++).toString();
                    key_mapping_a[key_a] = key_c;
                    keys_c.push(key_c);
                }
                data_c[key_c] = a.data[key_a];
                id_c = keys_c.indexOf(key_c);
            }
            row_c.push(encode(id_c));
        }
        grid_c.push(row_c.join(''));
    }

    return {
        grid : grid_c,
        data : data_c,
        keys : keys_c
    };
}

function decode(x) {
    if (x >= 93)
        x--;
    if (x >= 35)
        x--;
    return x - 32;
}
function encode(x) {
    x += 32;
    if (x >= 34)
        x++;
    if (x >= 92)
        x++;
    return String.fromCharCode(x);
}