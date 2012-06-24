var Collection = Backbone.Collection.extend({
  model: Model,
  isEmpty: function() {
    if (this.length > 0) {
      return false;
    } else {
      return this.length === 0 && this.isPopulated();
    }
  },
  isPopulated: function() {
    return this._fetched || this.length > 0 || (!this.length && !getValue(this, 'url'));
  },
  fetch: function(options) {
    options = options || {};
    var success = options.success;
    options.success = function(collection, response) {
      collection._fetched = true;
      success && success(collection, response);
    };
    return Backbone.Collection.prototype.fetch.apply(this, arguments);
  },
  reset: function(models, options) {
    this._fetched = !!models;
    return Backbone.Collection.prototype.reset.call(this, models, options);
  }
});
