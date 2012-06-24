_.extend(View.prototype, {
  render: function(output) {
    unbindPartials.call(this);
    if (typeof output === 'undefined' || (!_.isElement(output) && !is$(output) && !(output && output.el) && typeof output !== 'string')) {
      output = this.renderTemplate(this._template || getViewName.call(this), this._getContext(this.model));
    } else if (typeof output === 'function') {
      output = this.renderTemplate(output, this._getContext(this.model));
    }
    //accept a view, string, Handlebars.SafeString or DOM element
    this.html((output && output.el) || (output && output.string) || output);
    ++this._renderCount;
    this.trigger('rendered');
    return output;
  },

  context: function(model) {
    return model ? model.attributes : {};
  },

  _getContext: function(model) {
    if (typeof this.context === 'function') {
      return this.context(model);
    } else {
      var context = _.extend({}, (model && model.attributes) || {});
      _.each(this.context, function(value, key) {
        if (typeof value === 'function') {
          context[key] = value.call(this);
        } else {
          context[key] = value;
        }
      }, this);
      return context;
    }
  },

  renderTemplate: function(file, data, ignoreErrors) {
    data = getTemplateContext.call(this, data);
    if (typeof file === 'function') {
      template = file;
    } else {
      template = this.loadTemplate(file, data, Thorax.registry);
    }
    if (!template) {
      if (ignoreErrors) {
        return ''
      } else {
        throw new Error('Unable to find template ' + file);
      }
    } else {
      return template(data);
    }
  },

  loadTemplate: function(file, data, scope) {
    var fileName = Thorax.templatePathPrefix + file + (file.match(handlebarsExtensionRegExp) ? '' : '.' + handlebarsExtension);
    return scope.templates[fileName];
  },

  html: function(html) {
    if (typeof html === 'undefined') {
      return this.el.innerHTML;
    } else {
      var element;
      if (this._renderCount) {
        //preserveCollectionElements calls the callback after it has a reference
        //to the collection element, calls the callback, then re-appends the element
        preserveCollectionElements.call(this, function() {
          element = this.$el.html(html);
        });
      } else {
        element = this.$el.html(html);
      }
      appendViews.call(this);
      return element;
    }
  }
});

function ensureRendered() {
  !this._renderCount && this.render();
}

function getTemplateContext(data) {
  return _.extend({}, this, data || {}, {
    cid: _.uniqueId('t'),
    _view: this
  });
}

function appendViews(scope) {
  var self = this;
  if (!self._views) {
    return;
  }
  _.toArray($('[' + viewPlaceholderAttributeName + ']', scope || self.el)).forEach(function(el) {
    var placeholder_id = el.getAttribute(viewPlaceholderAttributeName),
        cid = placeholder_id.replace(/\-placeholder\d+$/, '');
        view = self._views[cid];
    if (view) {
      //see if the {{#view}} helper declared an override for the view
      //if not, ensure the view has been rendered at least once
      if (viewTemplateOverrides[placeholder_id]) {
        view.render(viewTemplateOverrides[placeholder_id](getTemplateContext.call(view)));
      } else {
        ensureRendered.call(view);
      }
      el.parentNode.insertBefore(view.el, el);
      el.parentNode.removeChild(el);
    }
  });
}
