module.exports = function() {
    return {
//        "srs" : "+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +no_defs +over",
//        "srs" : "+init=epsg:3857",
        "srs" : "+init=epsg:3857",
        "Stylesheet" : [ {
            'Map' : {
                'background-color' : 'white'
            },
            '#basemap' : {
                'line-width' : 1,
                'line-color' : 'red',
            }
        } ],
        "Layer" : [ {
            "name" : "basemap",
//            "srs" : "+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs",
        } ]

    }
}
