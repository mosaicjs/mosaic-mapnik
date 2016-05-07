module.exports = function toTilesProvider(obj, Type) {
    if (!obj)
        throw new Error('The "loadTile" method is not defined');
    if (typeof obj === 'function') {
        return {
            loadTile : obj
        };
    } else if (typeof obj.loadTile === 'function')
        return obj;
    if (!Type)
        throw new Error('TilesProvider type is not defined');
    return new Type(obj);
}