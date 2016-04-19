module.exports = function(layers, layerFields) {
    layers = toArray(layers, ';');
    layerFields = toArray(layerFields, ',');
    var result = [];
    layers.forEach(function(layer) {
        if (!layer)
            return;
        var fields = [];
        if (typeof layer === 'string') {
            var idx = layer.indexOf(':');
            if (idx > 0) {
                fields = layer.substring(idx + 1);
                layer = layer.substring(0, idx);
            }
        } else if (typeof layer === 'object') {
            fields = layer.fields;
            layer = layer.layer;
        }
        if (!layer)
            return;
        if (typeof fields === 'string') {
            fields = toArray(fields, ',');
        }
        fields = fields.length ? fields : layerFields; 
        result.push({
            layer : layer,
            fields : fields
        });
    });
    return result;
}

function toArray(val, delimiter) {
    if (!val)
        return [];
    if (val[0] === '[' || val[0] === '{') {
        val = JSON.parse(val);
    }
    if (typeof val === 'string') {
        val = val.split(delimiter);
    }
    if (!Array.isArray(val)) {
        val = [ val ];
    }
    return val;
}
