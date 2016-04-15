module.exports = {

    merge : function(list) {
        if (!Array.isArray(list))
            return list;
        var json;
        if (list.length > 1) {
            var features = [];
            list.map(function(obj) {
                features = features.concat(obj.features);
            });
            json = {
                type : 'FeatureCollection',
                features : features
            };
        } else if (list.length > 0) {
            json = list[0];
        } else {
            json = {
                type : 'FeatureCollection',
                features : []
            };
        }
        return json;
    }
}