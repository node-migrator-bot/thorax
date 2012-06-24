var Layout = View.extend({
  destroyViews: true,
  _ensureElement : function() {
    Backbone.View.prototype._ensureElement.call(this);
    //need real event delegation, do not contain to current view
    this.$el.delegate('a', 'click', _.bind(this.anchorClick, this));
  },

  render: function(output) {
    var response;
    //a template is optional in a layout
    var name = getViewName.call(this, true);
    if (output || this._template || (name && this.loadTemplate(name, {}, Thorax.registry))) {
      //but if present, it must have embedded an element containing layoutCidAttributeName 
      response = View.prototype.render.call(this, output);
      ensureLayoutViewsTargetElement.call(this);
    } else {
      ++this._renderCount;
      //set the layoutCidAttributeName on this.$el if there was no template
      this.$el.attr(layoutCidAttributeName, this.cid);
    }
    return response;
  },

  setView: function(view, params){
    ensureRendered.call(this);
    var old_view = this._view;
    if (view == old_view){
      return false;
    }
    this.trigger('change:view:start', view, old_view);
    old_view && old_view.trigger('deactivated');
    view && view.trigger('activated', params || {});
    if (old_view && old_view.el && old_view.el.parentNode) {
      old_view.$el.remove();
    }
    //make sure the view has been rendered at least once
    view && ensureRendered.call(view);
    view && getLayoutViewsTargetElement.call(this).appendChild(view.el);
    window.scrollTo(0, minimumScrollYOffset);
    this._view = view;
    this.destroyViews && old_view && old_view.destroy();
    this._view && this._view.trigger('ready');
    this.trigger('change:view:end', view, old_view);
    return view;
  },

  getView: function() {
    return this._view;
  },

  anchorClick: function(event) {
    var target = $(event.currentTarget);
    if (target.attr("data-external")) {
      return;
    }
    //ensure nested layouts only trigger the behavior once
    var containing_view_element = target.closest('[' + layoutCidAttributeName + ']');
    if (!containing_view_element.length || containing_view_element[0].getAttribute(layoutCidAttributeName) == this.cid) {
      var href = target.attr("href");
      // Route anything that starts with # or / (excluding //domain urls)
      if (href && (href[0] === '#' || (href[0] === '/' && href[1] !== '/'))) {
        Backbone.history.navigate(href, {trigger: true});
        event.preventDefault();
      }
    }
  }
});

function ensureLayoutViewsTargetElement() {
  if (!this.$('[' + layoutCidAttributeName + '="' + this.cid + '"]')[0]) {
    throw new Error();
  }
}

function getLayoutViewsTargetElement() {
  return this.$('[' + layoutCidAttributeName + '="' + this.cid + '"]')[0] || this.el[0] || this.el;
}
