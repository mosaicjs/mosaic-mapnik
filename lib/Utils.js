module.exports.ninvoke = function ninvoke(context, method) {
    var args = [];
    for (var i = 2; i < arguments.length; i++) {
        args.push(arguments[i]);
    }
    return new Promise(function(resolve, reject) {
        try {
            if (typeof method === 'string') {
                method = context[method];
            }
            args.push(function(err, result) {
                if (err)
                    return reject(err);
                else
                    return resolve(result);
            });
            return method.apply(context, args);
        } catch (err) {
            return reject(err);
        }
    });
}

module.exports.extend = function extend(target) {
    for (var i = 1; i < arguments.length; i++) {
        var source = arguments[i];
        for ( var key in source) {
            if (source.hasOwnProperty(key)) {
                target[key] = source[key];
            }
        }
    }
    return target;
}
