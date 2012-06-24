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

function getViewName(silent) {
  var name = this.name;
  if ((!name && !silent)) {
    throw new Error(this.cid + " requires a 'name' or 'template' attribute in order to be rendered.");
  } else if (name) {
    return name;
  }
}
