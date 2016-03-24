module.exports = function() {
    return {
        'Map' : {
            'background-color': 'cyan',
            'buffer-size' : 256,
        },
        '#basemap' : {
            '::geom' : {
                'polygon-fill' : '#f2eff9',
                'polygon-opacity' : 1,

                'line-width' : 0.1,
                'line-color' : '#426',
            },

            '::labels[zoom>4]' : {
                'text-name' : '[NAME]',
                'text-face-name' : 'Arial',
                'text-fill' : 'black',
                'text-size' : 12
            }
        }
    }
}
