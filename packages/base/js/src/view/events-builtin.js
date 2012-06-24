internalViewEvents['initialize:after'] = function(options) {
  //bind model or collection if passed to constructor
  if (options && options.model) {
    this.setModel(options.model);
  }
};

internalViewEvents['click [' + callMethodAttributeName + ']'] = function(event) {
  var target = $(event.target);
  event.preventDefault();
  this[target.attr(callMethodAttributeName)].call(this, event);
};

View.registerEvents(internalViewEvents);
