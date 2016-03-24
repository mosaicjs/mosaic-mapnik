var fs = require('fs');
module.exports = function(options) {
    return fs.readFileSync(__dirname + '/project.mml', 'UTF-8');
}