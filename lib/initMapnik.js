var mapnik = require('mapnik');
mapnik.register_system_fonts();
mapnik.register_default_fonts();
mapnik.register_default_input_plugins();
module.exports = mapnik;
