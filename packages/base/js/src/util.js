function getValue(object, prop) {
  if (!(object && object[prop])) {
    return null;
  }
  return _.isFunction(object[prop]) ? object[prop]() : object[prop];
}

//'selector' is not present in $('<p></p>')
//TODO: investigage a better detection method
function is$(obj) {
  return typeof obj === 'object' && ('length' in obj);
}
