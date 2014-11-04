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
loader.loadMss(projectDir).then(function(options){
    console.log('=============================');
    console.log('Mapnik configuration:');
    console.log(options);
    options.tmpDir = tmpDir;
    options.sourceId = 'test123';
    options.tileSize = 1024;
    var renderer = new MapnikRenderer(options);
    return Mosaic.P.then(function(){
        return renderTile(renderer);
        return renderFile(renderer);
    }).then(null, function(err) {
        console.log("Error! ", err);
    }).then(renderer.close, renderer.close);
}).then(null, function(err){
    console.log('ERROR!', err);
});

function renderTile(renderer){
    var format = 'png';
    format = 'utf';
    format = 'svg';
    var x = 0;
    var y = 0;
    var zoom = 0;
    return renderer.exec(function(r){
        var interactivity = renderer.options.config.interactivity || {};
        interactivity.fields = interactivity.fields || '';
        interactivity.fields = interactivity.fields.split(',');
        return r.renderTile({
            format : format,
            z : zoom,
            x : x,
            y : y,
            layer : interactivity.layer,
            fields : interactivity.fields,
        });
    }).then(function(result){
        var enc;
        if (format === 'utf'){
            result = JSON.stringify(result);
            enc = 'UTF-8';
        } else if (format === 'svg') {
            enc = 'UTF-8';
        }
        console.log('=============================');
        console.log('Tile: [' + x + ':' + y + ']. Zoom: ' + zoom);
        var file = './tmp/tile-' + zoom + '-' + x + '-' + y + '.' + format;
        return Mosaic.P.ninvoke(FS, FS.writeFile, file, result, enc);
    });
}

function renderFile(renderer){
    var format = 'png'; // 'svg', 'pdf', 'png'
    var zoom = 5;
    var file = Path.join(tmpDir, 'world-' + zoom + '.' + format);
    return renderer.exec(function(r){
        return r.renderMap({
            file : file,
            format : format,
            east : -6.0,
            north: 53.0,
            west : 12.0,
            south: 40.0,
            zoom : zoom
        });
    }).then(function(result){

        console.log('-----------------------------');
        console.log(result);
    });
}
