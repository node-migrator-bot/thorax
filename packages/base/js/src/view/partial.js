var Partial = function(cid, view, options) {
  this.cid = cid;
  this.view = view;
  //should contain fn, inverse, hash
  _.extend(this, options);
};
_.extend(Partial.prototype, Backbone.Events, {
  html: function(content) {
    var el = this.view.$('[' + partialCidAttributeName + '="' + this.cid + '"]');
    if (!content && content !== '') {
      return el.html();
    } else {
      el.html(content);
      appendViews.call(this.view, el[0]);
      return content;
    }
  },
  destroy: function() {
    this.trigger('destroyed');
  },
  context: function() {
    return this.view._getContext(this.view.model);
  }
});

function destroyPartials() {
  this._partials.forEach(function(partial) {
    partial.destroy();
  });
}
