//Backbone.View constructor doesn't provide everything we need
//so create a new one
var _viewsIndexedByCid = {};
var View = function(options) {
  this.cid = _.uniqueId('view');
  _viewsIndexedByCid[this.cid] = this;
  this._boundCollectionsByCid = {};
  this._partials = {};
  this._renderCount = 0;
  this._configure(options || {});
  this._ensureElement();
  this.delegateEvents();
  this.trigger('initialize:before', options);
  this.initialize.apply(this, arguments);
  this.trigger('initialize:after', options);
};

View.extend = Backbone.View.extend;

_.extend(View.prototype, Backbone.View.prototype, {
  _configure: function(options) {
    //this.options is removed in Thorax.View, we merge passed
    //properties directly with the view and template context
    _.extend(this, options || {});

    //compile a string or assign a function template if it is set as this.template
    if (this.template !== renderTemplate) {
      this._template = typeof this.template === 'string'
        ? Handlebars.compile(this.template)
        : this.template;
      this.template = renderTemplate;
    }
    
    //will be called again by Backbone.View(), after _configure() is complete but safe to call twice
    this._ensureElement();

    //model and collection events
    bindModelAndCollectionEvents.call(this, this.constructor.events);
    if (this.events) {
      bindModelAndCollectionEvents.call(this, this.events);
    }

    //mixins
    for (var i = 0; i < this.constructor.mixins.length; ++i) {
      applyMixin.call(this, this.constructor.mixins[i]);
    }
    if (this.mixins) {
      for (var i = 0; i < this.mixins.length; ++i) {
        applyMixin.call(this, this.mixins[i]);
      }
    }

    //views
    this._views = {};
    if (this.views) {
      for (var local_name in this.views) {
        if (_.isArray(this.views[local_name])) {
          this[local_name] = this.view.apply(this, this.views[local_name]);
        } else {
          this[local_name] = this.view(this.views[local_name]);
        }
      }
    }
  },

  _ensureElement : function() {
    Backbone.View.prototype._ensureElement.call(this);
    (this.el[0] || this.el).setAttribute(viewNameAttributeName, this.name || this.cid);
    (this.el[0] || this.el).setAttribute(viewCidAttributeName, this.cid);      
  },

  view: function(name, options) {
    if (typeof name === 'object' && name.hash && name.hash.name) {
      // named parameters
      options = name.hash;
      name = name.hash.name;
      delete options.name;
    }
    var instance = getView(name, options);
    this._views[instance.cid] = instance;
    return instance;
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
  },

  _shouldFetch: function(model_or_collection, options) {
    var url = (
      (!model_or_collection.collection && getValue(model_or_collection, 'urlRoot')) ||
      (model_or_collection.collection && getValue(model_or_collection.collection, 'url')) ||
      (!model_or_collection.collection && model_or_collection._byCid && model_or_collection._byId && getValue(model_or_collection, 'url'))
    );
    return url && options.fetch && (
      typeof model_or_collection.isPopulated === 'undefined' || !model_or_collection.isPopulated()
    );
  },

  bindCollection: function(collection, options) {
    var old_collection = this.collection;

    if (old_collection) {
      this.freeze(old_collection);
    }

    if (collection) {
      collection.cid = collection.cid || _.uniqueId('collection');
      options = this.setCollectionOptions(collection, options);

      this._boundCollectionsByCid[collection.cid] = collection;
      this._events.collection.forEach(function(event) {
        collection.bind(event[0], event[1]);
      });
    
      collection.trigger('set', collection, old_collection);

      if (this._shouldFetch(collection, options)) {
        this._loadCollection(collection, options);
      } else {
        //want to trigger built in event handler (render())
        //without triggering event on collection
        onCollectionReset.call(this, collection);
      }
    }

    return this;
  },

  _getCollectionElement: function(collection) {
    //DEPRECATION: this._collectionSelector for backwards compatibility with < 1.3
    var selector = this._collectionSelector || '[' + collectionCidAttributeName + '="' + collection.cid + '"]';
    var elements = this.$(selector);
    if (elements.length > 1) {
      //TODO: Zepto 1.0 should support jQuery style filter()
      var cid = this.cid;
      return $(_.filter(elements, function(element) {
        return cid === $(element).closest('[' + viewNameAttributeName + ']').attr(viewNameAttributeName);
      }));
    } else {
      return elements;
    }
  },

  _loadCollection: function(collection, options) {
    collection.fetch(options);
  },

  setCollectionOptions: function(collection, options) {
    if (!this._collectionOptionsByCid) {
      this._collectionOptionsByCid = {};
    }
    this._collectionOptionsByCid[collection.cid] = {
      fetch: true,
      success: false,
      errors: true
    };
    _.extend(this._collectionOptionsByCid[collection.cid], options || {});
    return this._collectionOptionsByCid[collection.cid];
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


  //appendItem(collection, model [,index])
  //appendItem(collection, html_string, index)
  //appendItem(collection, view, index)
  appendItem: function(collection, model, index, options) {
    //DEPRECATION: backwards compatibility with < 1.3
    if (typeof collection.length === 'undefined' && !collection.models) {
      collection = this.collection;
      model = arguments[0];
      index = arguments[1];
      options = arguments[2];
    }

    //empty item
    if (!model) {
      return;
    }

    var item_view,
        collection_element = (options && options.collectionElement) || this._getCollectionElement(collection);

    options = options || {};

    //if index argument is a view
    if (index && index.el) {
      index = collection_element.children().indexOf(index.el) + 1;
    }

    //if argument is a view, or html string
    if (model.el || typeof model === 'string') {
      item_view = model;
      model = false;
    } else {
      index = index || collection.indexOf(model) || 0;
      item_view = this.renderItem(model, index, collection);
    }

    if (item_view) {

      if (item_view.cid) {
        this._views[item_view.cid] = item_view;
      }

      //if the renderer's output wasn't contained in a tag, wrap it in a div
      //plain text, or a mixture of top level text nodes and element nodes
      //will get wrapped
      if (typeof item_view === 'string' && !item_view.match(/^\s*\</m)) {
        item_view = '<div>' + item_view + '</div>'
      }

      var item_element = item_view.el ? [item_view.el] : _.filter($(item_view), function(node) {
        //filter out top level whitespace nodes
        return node.nodeType === ELEMENT_NODE_TYPE;
      });

      if (model) {
        $(item_element).attr(modelCidAttributeName, model.cid);
      }
      var previous_model = index > 0 ? collection.at(index - 1) : false;
      if (!previous_model) {
        collection_element.prepend(item_element);
      } else {
        //use last() as appendItem can accept multiple nodes from a template
        collection_element.find('[' + modelCidAttributeName + '="' + previous_model.cid + '"]').last().after(item_element);
      }

      appendViews.call(this, item_element);

      if (!options.silent) {
        this.trigger('rendered:item', item_element);
      }
    }
    return item_view;
  },

  destroy: function() {
    this.freeze();
    this.trigger('destroyed');
    if (this.undelegateEvents) {
      this.undelegateEvents();
    }
    this.unbind();
    this._events = {};
    this._boundCollectionsByCid = {};
    this.el = null;
    this.collection = null;
    this.model = null;
    delete _viewsIndexedByCid[this.cid];
    destroyChildViews.call(this);
  },

  scrollTo: function(x, y) {
    y = y || minimumScrollYOffset;
    function _scrollTo() {
      window.scrollTo(x, y);
    }
    if ($.os && $.os.ios) {
      // a defer is required for ios
      _.defer(_scrollTo);
    } else {
      _scrollTo();
    }
    return [x, y];
  },

  scrollToTop: function() {
    // android will use height of 1 because of minimumScrollYOffset
    return this.scrollTo(0, 0);
  }
});

View.prototype.template = renderTemplate = View.prototype.renderTemplate;

_.extend(View, {
  registerHelper: function(name, callback) {
    this[name] = callback;
    Handlebars.registerHelper(name, this[name]);
  },
  expandToken: function(input, scope) {
    if (input && input.indexOf && input.indexOf('{{') >= 0) {
      var re = /(?:\{?[^{]+)|(?:\{\{([^}]+)\}\})/g,
          match,
          ret = [];
      function deref(token, scope) {
        var segments = token.split('.'),
            len = segments.length;
        for (var i = 0; scope && i < len; i++) {
          if (segments[i] !== 'this') {
            scope = scope[segments[i]];
          }
        }
        return scope;
      }
      while (match = re.exec(input)) {
        if (match[1]) {
          var params = match[1].split(/\s+/);
          if (params.length > 1) {
            var helper = params.shift();
            params = params.map(function(param) { return deref(param, scope); });
            if (Handlebars.helpers[helper]) {
              ret.push(Handlebars.helpers[helper].apply(scope, params));
            } else {
              // If the helper is not defined do nothing
              ret.push(match[0]);
            }
          } else {
            ret.push(deref(params[0], scope));
          }
        } else {
          ret.push(match[0]);
        }
      }
      input = ret.join('');
    }
    return input;
  },
  tag: function(attributes, content, scope) {
    var htmlAttributes = _.clone(attributes),
        tag = htmlAttributes.tag || htmlAttributes.tagName || 'div';
    if (htmlAttributes.tag) {
      delete htmlAttributes.tag;
    }
    if (htmlAttributes.tagName) {
      delete htmlAttributes.tagName;
    }
    if (htmlAttributes.call) {
      htmlAttributes[callMethodAttributeName] = htmlAttributes.call;
      delete htmlAttributes.tagName;
    }
    return '<' + tag + ' ' + _.map(htmlAttributes, function(value, key) {
      if (typeof value === 'undefined') {
        return '';
      }
      var formattedValue = value;
      if (scope) {
        formattedValue = View.expandToken(value, scope);
      }
      return key + '="' + Handlebars.Utils.escapeExpression(formattedValue) + '"';
    }).join(' ') + '>' + (content || '') + '</' + tag + '>';
  }
});

var viewTemplateOverrides = {};
View.registerHelper('view', function(view, options) {
  if (!view) {
    return '';
  }
  var instance = this._view.view(view, options ? options.hash : {}),
      placeholder_id = instance.cid + '-' + _.uniqueId('placeholder');
  if (options.fn) {
    viewTemplateOverrides[placeholder_id] = options.fn;
  }
  return new Handlebars.SafeString('<div ' + viewPlaceholderAttributeName + '="' + placeholder_id + '"></div>');
});

View.registerHelper('template', function(name, options) {
  var context = _.extend({}, this, options ? options.hash : {});
  var output = View.prototype.renderTemplate.call(this._view, name, context);
  return new Handlebars.SafeString(output);
});

View.registerHelper('collection', function(collection, options) {
  //DEPRECATION: backwards compatibility with < 1.3
  if (arguments.length === 1) {
    options = collection;
    collection = this._view.collection;
  }
  //end DEPRECATION
  if (collection) {
    var collectionOptionsToExtend = {
      'item-template': options.fn && options.fn !== Handlebars.VM.noop ? options.fn : options.hash['item-template'],
      'empty-template': options.inverse && options.inverse !== Handlebars.VM.noop ? options.inverse : options.hash['empty-template'],
      'item-view': options.hash['item-view'],
      'empty-view': options.hash['empty-view'],
      filter: options.hash['filter']
    };
    ensureCollectionIsBound.call(this._view, collection, collectionOptionsToExtend);
    var collectionHelperOptions = _.clone(options.hash);
    _.keys(collectionOptionsToExtend).forEach(function(key) {
      delete collectionHelperOptions[key];
    });
    collectionHelperOptions[collectionCidAttributeName] = collection.cid;
    if (collection.name) {
      collectionHelperOptions[collectionNameAttributeName] = collection.name;
    }
    return new Handlebars.SafeString(View.tag.call(this, collectionHelperOptions, null, this));
  } else {
    return '';
  }
});

View.registerHelper('empty', function(collection, options) {
  var empty;
  if (!options) {
    options = arguments[0];
    empty = !this._view.model || (this._view.model && !this._view.model.isEmpty());
  } else {
    if (!collection) {
      empty = true;
    } else {
      ensureCollectionIsBound.call(this._view, collection);
      empty = collection.isEmpty();
      this._view._collectionOptionsByCid[collection.cid].renderOnEmptyStateChange = true;
    }
  }
  if (empty) {
    this._view.trigger('rendered:empty', collection);
    return options.fn(this);
  } else {
    return options.inverse(this);
  }
});

View.registerHelper('url', function(url) {
  return (Backbone.history._hasPushState ? Backbone.history.options.root : '#') + url;
});

View.registerHelper('layout', function(options) {
  options.hash[layoutCidAttributeName] = this._view.cid;
  return new Handlebars.SafeString(View.tag.call(this, options.hash, null, this));
});

View.registerPartialHelper = function() {

};

View.registerPartialHelper('collection', function() {

});

View.registerHelper('partial', function(name, options) {
  this._view._partials || (this._view._partials = {});
  this._view._partials[name] = this._view[name];
  //if anonymous is true the partial and the method wrapper
  //will both be deleted on the next render
  if (options.hash.anonymous) {
    this._view._partials[name].anonymous = true;
    delete options.hash.anonymous;
  }
  this._view[name] = function(callOptions) {
    var optionsForCallback = options;
    if (callOptions) {
      optionsForCallback = _.extend({}, options);
      optionsForCallback.hash = _.extend({}, options.hash, callOptions.hash || callOptions);
    }
    var output = this._partials[name].call(this, wrapPartialOptionsBlockCallback(optionsForCallback));
    this.$('[' + partialAttributeName + '="' + name + '"]').html(output);
  }
  options.hash[partialAttributeName] = name;
  return new Handlebars.SafeString(View.tag(options.hash, this._view._partials[name].call(this._view, wrapPartialOptionsBlockCallback(options)), this));
});

function wrapPartialOptionsBlockCallback(options) {
  if (options && options.fn) {
    var callback = options.fn;
    options.fn = function(scope) {
      return callback(getTemplateContext(scope));
    };
  }
  return options;
}

function unbindPartialsOfType(type) {

}

function unbindPartials() {
  for (var name in (this._partials || {})) {
    if (!this._partials[name].anonymous) {
      this[name] = this._partials[name];
    } else {
      delete this[name];
    }
    delete this._partials[name];
  }
}

//private Thorax.View methods
function getView(name, attributes) {
  if (typeof name === 'string') {
    if (!Thorax.registry.Views[name]) {
      throw new Error('view: ' + name + ' does not exist.');
    }
    return new Thorax.registry.Views[name](attributes);
  } else if (typeof name === 'function') {
    return new name(attributes);
  } else {
    return name;
  }
}

function getViewName(silent) {
  var name = this.name;
  if ((!name && !silent)) {
    throw new Error(this.cid + " requires a 'name' or 'template' attribute in order to be rendered.");
  } else if (name) {
    return name;
  }
}

function ensureRendered() {
  !this._renderCount && this.render();
}

function ensureCollectionIsBound(collection, options) {
  if (!this._boundCollectionsByCid[collection.cid]) {
    this.bindCollection(collection, options);
  } else if (options) {
    _.extend(this._collectionOptionsByCid[collection.cid], options);
  }
}

function getTemplateContext(data) {
  return _.extend({}, this, data || {}, {
    cid: _.uniqueId('t'),
    _view: this
  });
}

function onCollectionReset(collection) {
  this.renderCollection(collection);
}

function preserveCollectionElements(callback) {
  var old_collection_elements_by_cid = {},
      cid;
  for (cid in this._boundCollectionsByCid) {
    old_collection_elements_by_cid[cid] = this._getCollectionElement(this._boundCollectionsByCid[cid]);
  }
  callback.call(this);
  for (cid in this._boundCollectionsByCid) {
    var new_collection_element = this._getCollectionElement(this._boundCollectionsByCid[cid]),
        old_collection_element = old_collection_elements_by_cid[cid];
    if (old_collection_element.length && new_collection_element.length) {
      new_collection_element[0].parentNode.insertBefore(old_collection_element[0], new_collection_element[0]);
      new_collection_element[0].parentNode.removeChild(new_collection_element[0]);
    }
  }
}

function renderCollection(collection) {
  //DEPRECATION: backwards compatibility with < 1.3
  if (!collection) {
    collection = this.collection;
  }
  //end DEPRECATION
  this.render();
  var collection_element = this._getCollectionElement(collection).empty();
  if (collection.isEmpty()) {
    collection_element.attr(collectionEmptyAttributeName, true);
    appendEmpty.call(this, collection);
  } else {
    var collectionOptions = this._collectionOptionsByCid[collection.cid];
    collection_element.removeAttr(collectionEmptyAttributeName);
    collection.forEach(function(item, i) {
      if (!collectionOptions.filter || collectionOptions.filter &&
        (typeof collectionOptions.filter === 'string'
            ? this[collectionOptions.filter]
            : collectionOptions.filter).call(this, item, i)
        ) {
        this.appendItem(collection, item, i, {
          collectionElement: collection_element
        });
      }
    }, this);
  }
  this.trigger('rendered:collection', collection_element, collection);
}

function renderEmpty(collection) {
  if (!collection) {
    collection = this.collection;
  }
  var collection_options = this._collectionOptionsByCid[collection.cid],
      context = this.emptyContext();
  if (collection_options['empty-view']) {
    var view = this.view(collection_options['empty-view'], context);
    view.render(collection_options['empty-template']);
    return view;
  } else {
    var emptyTemplate = collection_options['empty-template'];
    if (!emptyTemplate) {
      var name = getViewName.call(this, true);
      if (name) {
        emptyTemplate = this.loadTemplate(name + '-empty', {}, Thorax.registry);
      }
      if (!emptyTemplate) {
        return;
      }
    }
  }
  return this.renderTemplate(emptyTemplate, context);
}

function renderItem(item, i, collection) {
  if (!collection) {
    collection = this.collection;
  }
  var collection_options = this._collectionOptionsByCid[collection.cid];
  if (collection_options['item-view']) {
    var view = this.view(collection_options['item-view'], {
      model: item
    });
    view.render(collection_options['item-template']);
    return view;
  } else {
    var context = this.itemContext(item, i);
    return this.renderTemplate(collection_options['item-template'] || getViewName.call(this) + '-item', context);
  }
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

function destroyChildViews() {
  for (var id in this._views || {}) {
    if (this._views[id].destroy) {
      this._views[id].destroy();
    }
    this._views[id] = null;
  }
}

function appendEmpty(collection) {
  var collection_element = this._getCollectionElement(collection).empty();
  this.appendItem(collection, this.renderEmpty(collection), 0, {
    silent: true,
    collectionElement: collection_element
  });
  this.trigger('rendered:empty', collection);
}
