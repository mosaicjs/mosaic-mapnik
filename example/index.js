var Mosaic = require('mosaic-commons');
var MapnikConfigLoader = require('../').MapnikConfigLoader;
var MapnikRenderer = require('../').MapnikRenderer;
var FS = require('fs');
var Path = require('path');

var projectDir = Path.join(__dirname, 'project');
var tmpDir = Path.join(__dirname, 'tmp');
if (!FS.existsSync(tmpDir)) {
    FS.mkdirSync(tmpDir);
}

var loader = new MapnikConfigLoader({
    // Used by millstone to download externaal data sources
    tmpDir : tmpDir
});
loader.loadMss(projectDir).then(function(xml){
    var renderer = new MapnikRenderer({
        // The resulting file is generated in this folder
        tmpDir : tmpDir
    });
    var format = 'png'; // 'svg', 'pdf', 'png'
    var zoom = 5;
    var file = Path.join(tmpDir, 'world-' + zoom + '.' + format);
    return renderer.renderMap({
        xml : xml,
        file : file,
        format : format,
        east : -6.0,
        north: 53.0,
        west : 12.0,
        south: 40.0,
        zoom : zoom,
        sourceId : file
    }).then(function(result){
        console.log('=============================');
        console.log('Mapnik configuration:');
        console.log(xml);
        console.log('-----------------------------');
        console.log(result);
    });
}).then(null, function(err){
    console.log('ERROR!', err);
});
