var fs = require('fs');

module.exports.readJson = readJson;
module.exports.readFile = readFile;
module.exports.getPath = getPath;
module.exports.runTest = runTest;

function readJson(path) {
    var str = readFile(path);
    return JSON.parse(str);
}

function readFile(path) {
    return fs.readFileSync(path, 'UTF-8');
}

function getPath(name) {
    return __dirname + '/data/' + name;
}

function runTest(msg, f) {
    it(msg, function(done) {
        return Promise.resolve().then(function() {
            return f();
        }).then(function() {
            done();
        }, done);
    });
}
