(function(){
  if (typeof this.$ === 'undefined') {
    throw new Error('jquery.js/zepto.js required to run Thorax');
  } else {
    if (!$.fn.forEach) {
      // support jquery/zepto iterators
      $.fn.forEach = $.fn.each;
     }
  }

  if (typeof this._ === 'undefined') {
    throw new Error('Underscore.js required to run Thorax');
  }

  if (typeof this.Backbone === 'undefined') {
    throw new Error('Backbone.js required to run Thorax');
  }

var handlebarsExtension = 'handlebars',
    handlebarsExtensionRegExp = new RegExp('\\.' + handlebarsExtension + '$'),
    layoutCidAttributeName = 'data-layout-cid',
    viewNameAttributeName = 'data-view-name',
    viewCidAttributeName = 'data-view-cid',
    callMethodAttributeName = 'data-call-method',
    viewPlaceholderAttributeName = 'data-view-tmp',
    modelCidAttributeName = 'data-model-cid',
    modelNameAttributeName = 'data-model-name',
    collectionCidAttributeName = 'data-collection-cid',
    collectionNameAttributeName = 'data-collection-name',
    collectionEmptyAttributeName = 'data-collection-empty',
    partialCidAttributeName = 'data-partial-cid',
    partialPlaceholderAttributeName = 'data-partial-tmp',
    oldBackboneView = Backbone.View,
    //android scrollTo(0, 0) shows url bar, scrollTo(0, 1) hides it
    minimumScrollYOffset = (navigator.userAgent.toLowerCase().indexOf("android") > -1) ? 1 : 0,
    ELEMENT_NODE_TYPE = 1;
    var renderTemplate;

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
    //destroy child views
    for (var id in this._views || {}) {
      if (this._views[id].destroy) {
        this._views[id].destroy();
      }
      this._views[id] = null;
    }
  }
});

View.prototype.mixin = function(name) {
  if (!this._appliedMixins) {
    this._appliedMixins = [];
  }
  if (this._appliedMixins.indexOf(name) == -1) {
    this._appliedMixins.push(name);
    if (typeof name === 'function') {
      name.call(this);
    } else {
      var mixin = Thorax.registry.Mixins[name];
      _.extend(this, mixin[1]);
      //mixin callback may be an array of [callback, arguments]
      if (_.isArray(mixin[0])) {
        mixin[0][0].apply(this, mixin[0][1]);
      } else {
        mixin[0].apply(this, _.toArray(arguments).slice(1));
      }
    }
  }
};

_.extend(View, {
  registerMixin: function(name, callback, methods) {
    Thorax.registry.Mixins[name] = [callback, methods];
  },
  mixins: [],
  mixin: function(mixin) {
    this.mixins.push(mixin);
  }
});

function applyMixin(mixin) {
  if (_.isArray(mixin)) {
    this.mixin.apply(this, mixin);
  } else {
    this.mixin(mixin);
  }
}

var internalViewEvents = {};

_.extend(View.prototype, {
  //allow events hash to specify view, collection and model events
  //as well as DOM events. Merges Thorax.View.events with this.events
  delegateEvents: function(events) {
    this.undelegateEvents && this.undelegateEvents();
    //bindModelAndCollectionEvents on this.constructor.events and this.events
    //done in _configure
    this.registerEvents(this.constructor.events);
    if (this.events) {
      this.registerEvents(this.events);
    }
    if (events) {
      this.registerEvents(events);
      bindModelAndCollectionEvents.call(this, events);
    }
  },

  registerEvents: function(events) {
    processEvents.call(this, events).forEach(this._addEvent, this);
  },

  //params may contain:
  //- name
  //- originalName
  //- selector
  //- type "view" || "DOM"
  //- handler
  _addEvent: function(params) {
    if (params.type === 'view') {
      this.bind(params.name, params.handler, this);
    } else {
      var boundHandler = containHandlerToCurentView(bindEventHandler.call(this, params.handler), this.cid);
      if (params.selector) {
        //TODO: determine why collection views and some nested views
        //need defered event delegation 
        if (typeof jQuery !== 'undefined' && $ === jQuery) {
          _.defer(_.bind(function() {
            this.$el.delegate(params.selector, params.name, boundHandler);
          }, this));
        } else {
          this.$el.delegate(params.selector, params.name, boundHandler);
        }
      } else {
        this.$el.bind(params.name, boundHandler);
      }
    }
  },

  freeze: function(modelOrCollection) {
    if (this.model && (modelOrCollection === this.model || !modelOrCollection)) {
      this._events.model.forEach(function(event) {
        this.model.unbind(event[0], event[1]);
      }, this);
    }
    _.each(this._partials, function(partial, cid) {
      partial.freeze();
    });
  }
});

_.extend(View, {
  //events for all views
  events: {
    model: {},
    collection: {}
  },
  registerEvents: function(events) {
    for(var name in events) {
      if (name === 'model' || name === 'collection') {
        for (var _name in events[name]) {
          addEvent(this.events[name], _name, events[name][_name]);
        }
      } else {
        addEvent(this.events, name, events[name]);
      }
    }
  },
  unregisterEvents: function(events) {
    if (typeof events === 'undefined') {
      this.events = {
        model: {},
        collection: {}
      };
    } else if (typeof events === 'string' && arguments.length === 1) {
      if (events === 'model' || events === 'collection') {
        this.events[events] = {};
      } else {
        this.events[events] = [];
      }
    //remove collection or model events
    } else if (arguments.length === 2) {
      this.events[arguments[0]][arguments[1]] = [];
    }
  }
});

function containHandlerToCurentView(handler, cid) {
  return function(event) {
    var containing_view_element = $(event.target).closest('[' + viewNameAttributeName + ']');
    if (!containing_view_element.length || containing_view_element[0].getAttribute(viewCidAttributeName) == cid) {
      handler(event);
    }
  };
}

var domEvents = [
  'mousedown', 'mouseup', 'mousemove', 'mouseover', 'mouseout',
  'touchstart', 'touchend', 'touchmove',
  'click', 'dblclick',
  'keyup', 'keydown', 'keypress',
  'submit', 'change',
  'focus', 'blur'
];

function bindEventHandler(callback) {
  var method = typeof callback === 'function' ? callback : this[callback];
  if (!method) {
    throw new Error('Event "' + callback + '" does not exist');
  }
  return _.bind(method, this);
}

function processEvents(events) {
  if (_.isFunction(events)) {
    events = events.call(this);
  }
  var processedEvents = [];
  for (var name in events) {
    if (name !== 'model' && name !== 'collection') {
      if (name.match(/,/)) {
        name.split(/,/).forEach(function(fragment) {
          processEventItem.call(this, fragment.replace(/(^[\s]+|[\s]+$)/g, ''), events[name], processedEvents);
        }, this);
      } else {
        processEventItem.call(this, name, events[name], processedEvents);
      }
    }
  }
  return processedEvents;
}

function processEventItem(name, handler, target) {
  if (_.isArray(handler)) {
    for (var i = 0; i < handler.length; ++i) {
      target.push(eventParamsFromEventItem.call(this, name, handler[i]));
    }
  } else {
    target.push(eventParamsFromEventItem.call(this, name, handler));
  }
}

function addEvent(target, name, handler) {
  if (!target[name]) {
    target[name] = [];
  }
  if (_.isArray(handler)) {
    for (var i = 0; i < handler.length; ++i) {
      target[name].push(handler[i]);
    }
  } else {
    target[name].push(handler);
  }
}

var eventSplitter = /^(\S+)(?:\s+(.+))?/;

function eventParamsFromEventItem(name, handler) {
  var params = {
    originalName: name,
    handler: typeof handler === 'string' ? this[handler] : handler
  };
  var match = eventSplitter.exec(name);
  params.name = match[1];
  if (isDOMEvent(params.name)) {
    params.type = 'DOM';
    params.name += '.delegateEvents' + this.cid;
    params.selector = match[2];
  } else {
    params.type = 'view';
  }
  return params;
}

function isDOMEvent(name) {
  return !(!name.match(/\s+/) && domEvents.indexOf(name) === -1);
}

//model/collection events, to be bound/unbound on setModel/setCollection
function processModelOrCollectionEvent(events, type) {
  for (var _name in events[type] || {}) {
    if (_.isArray(events[type][_name])) {
      for (var i = 0; i < events[type][_name].length; ++i) {
        this._events[type].push([_name, bindEventHandler.call(this, events[type][_name][i])]);
      }
    } else {
      this._events[type].push([_name, bindEventHandler.call(this, events[type][_name])]);
    }
  }
}

function bindModelAndCollectionEvents(events) {
  if (!this._events) {
    this._events = {
      model: [],
      collection: []
    };
  }
  processModelOrCollectionEvent.call(this, events, 'model');
  processModelOrCollectionEvent.call(this, events, 'collection');
}


internalViewEvents.model = {
  error: function(model, errors){
    if (this._modelOptions.errors) {
      this.trigger('error', errors);
    }
  },
  change: function() {
    this._onModelChange();
  }
};

_.extend(View.prototype, {
  setModel: function(model, options) {
    var el = (this.el[0] || this.el);
    el.setAttribute(modelCidAttributeName, model.cid);
    if (model.name) {
      el.setAttribute(modelNameAttributeName, model.name);
    }

    var old_model = this.model;

    if (old_model) {
      this.freeze(old_model);
    }

    if (model) {
      this.model = model;
      this.setModelOptions(options);

      this._events.model.forEach(function(event) {
        this.model.bind(event[0], event[1]);
      }, this);

      this.model.trigger('set', this.model, old_model);
  
      if (this._shouldFetch(this.model, this._modelOptions)) {
        var success = this._modelOptions.success;
        this._loadModel(this.model, this._modelOptions);
      } else {
        //want to trigger built in event handler (render() + populate())
        //without triggering event on model
        this._onModelChange();
      }
    }

    return this;
  },

  _onModelChange: function() {
    if (this._modelOptions.render) {
      this.render();
    }
  },

  _loadModel: function(model, options) {
    model.fetch(options);
  },

  setModelOptions: function(options) {
    if (!this._modelOptions) {
      this._modelOptions = {
        fetch: true,
        success: false,
        render: true,
        populate: true,
        errors: true
      };
    }
    _.extend(this._modelOptions, options || {});
    return this._modelOptions;
  }
});

_.extend(View.prototype, {
  render: function(output) {
    destroyPartials.call(this);
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
      var element = this.$el.html(html);
      //TODO: find better solution for problem of partials embedding views embedding partials embedding....
      appendPartials.call(this);
      appendViews.call(this);
      appendPartials.call(this);
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

var Partial = function(cid, view, options) {
  this.cid = cid;
  this.view = view;
  this.fn = options.fn;
  this.inverse = options.inverse;
  this.options = options.hash;
  this._ensureElement();
};

_.extend(Partial.prototype, Backbone.Events, {
  _ensureElement: function() {
    var htmlAttributes = View.htmlAttributesFromOptions(this.options);
    delete htmlAttributes.tag;
    delete htmlAttributes.tagName;
    htmlAttributes[partialCidAttributeName] = this.cid;
    this.el = Backbone.View.prototype.make.call(this, this.options.tagName || this.options.tag || 'div', htmlAttributes);
    this.$el = $(this.el);
  },
  html: function(html) {
    if (typeof html === 'undefined') {
      return this.el.innerHTML;
    } else {
      //html may be a SafeString, so call toString()
      var element = this.$el.html(html.toString());
      //TODO: find better solution for problem of partials embedding views embedding partials embedding....
      appendPartials.call(this.view, this.el);
      appendViews.call(this.view, this.el);
      appendPartials.call(this.view, this.el);
      return element;
    }
  },
  freeze: function() {
    this.trigger('freeze');
  },
  destroy: function() {
    this.freeze();
    this.trigger('destroyed');
  },
  context: function() {
    return this.view._getContext(this.view.model);
  }
});

_.extend(View.prototype, {
  partial: function(options) {
    var cid = _.uniqueId('partial');
    return new Partial(cid, this, options);
  }
});

View.registerPartialHelper = function(name, callback) {
  return View.registerHelper(name, function() {
    var args = _.toArray(arguments),
        options = args.pop(),
        partial = this._view.partial(options);
    args.push(partial);
    this._view._partials[partial.cid] = partial;
    var htmlAttributes = {};
    htmlAttributes[partialPlaceholderAttributeName] = partial.cid;
    callback.apply(this, args);
    return new Handlebars.SafeString(View.tag(htmlAttributes, ''));
  });
};

//called from View.prototype.html()
function appendPartials(scope) {
  _.toArray($(scope || this.el).find('[' + partialPlaceholderAttributeName + ']')).forEach(function(el) {
    var cid = el.getAttribute(partialPlaceholderAttributeName),
        partial = this._partials[cid];
    if (partial) {
      el.parentNode.insertBefore(partial.el, el);
      el.parentNode.removeChild(el);
    }
  }, this);
}

function destroyPartials() {
  _.each(this._partials, function(partial, cid) {
    partial.destroy();
  });
  this._partials = {};
}

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
  },
  htmlAttributesFromOptions: function(options) {
    var htmlAttributes = {};
    if (options.tag) {
      htmlAttributes.tag = options.tag;
    }
    if (options.tagName) {
      htmlAttributes.tagName = options.tagName;
    }
    if (options['class']) {
      htmlAttributes['class'] = options['class'];
    }
    if (options.id) {
      htmlAttributes.id = options.id;
    }
    return htmlAttributes
  }
});

View.registerHelper('template', function(name, options) {
  var context = _.extend({}, this, options ? options.hash : {});
  var output = View.prototype.renderTemplate.call(this._view, name, context);
  return new Handlebars.SafeString(output);
});

View.registerHelper('url', function(url) {
  return (Backbone.history._hasPushState ? Backbone.history.options.root : '#') + url;
});

View.registerHelper('layout', function(options) {
  options.hash[layoutCidAttributeName] = this._view.cid;
  return new Handlebars.SafeString(View.tag.call(this, options.hash, null, this));
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
  var htmlAttributes = View.htmlAttributesFromOptions(options.hash);
  htmlAttributes[viewPlaceholderAttributeName] = placeholder_id;
  return new Handlebars.SafeString(View.tag.call(this, htmlAttributes));
});

//called from View.prototype.html()
function appendViews(scope) {
  if (!this._views) {
    return;
  }
  _.toArray($(scope || this.el).find('[' + viewPlaceholderAttributeName + ']')).forEach(function(el) {
    var placeholder_id = el.getAttribute(viewPlaceholderAttributeName),
        cid = placeholder_id.replace(/\-placeholder\d+$/, '');
        view = this._views[cid];
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
  }, this);
}

internalViewEvents.collection = {
  add: function(partial, model, collection) {
    var collectionElement = partial.$el;
        collectionOptions = partial.options;
    if (collection.length === 1) {
      if(collectionElement.length) {
        //note that this is $.empty() and not renderEmpty or other collection functionality
        collectionElement.removeAttr(collectionEmptyAttributeName);
        collectionElement.empty();
      }
    }
    if (collectionElement.length) {
      var index = collection.indexOf(model);
      if (!collectionOptions.filter || collectionOptions.filter &&
        (typeof collectionOptions.filter === 'string'
            ? this[collectionOptions.filter]
            : collectionOptions.filter).call(this, model, index)
        ) {
        this.appendItem(partial, collection, model, index);
      }
    }
  },
  remove: function(partial, model, collection) {
    var collectionElement = partial.$el;
    collectionElement.find('[' + modelCidAttributeName + '="' + model.cid + '"]').remove();
    for (var cid in this._views) {
      if (this._views[cid].model && this._views[cid].model.cid === model.cid) {
        this._views[cid].destroy();
        delete this._views[cid];
        break;
      }
    }
    if (collection.length === 0) {
      if (collectionElement.length) {
        collectionElement.attr(collectionEmptyAttributeName, true);
        appendEmpty.call(this, partial, collection);
      }
    }
  },
  reset: function(partial, collection) {
    onCollectionReset.call(this, partial, collection);
  },
  error: function(partial, collection, message) {
    if (partial.options.errors) {
      this.trigger('error', message);
    }
  }
};

View.registerPartialHelper('collection', function(collection, partial) {
  //DEPRECATION: backwards compatibility with < 1.3
  if (arguments.length === 1) {
    partial = collection;
    collection = this._view.collection;
  }
  //end DEPRECATION
  if (collection) {
    _.extend(partial.options, {
      'item-template': partial.fn && partial.fn !== Handlebars.VM.noop ? partial.fn : partial.options['item-template'],
      'empty-template': partial.inverse && partial.inverse !== Handlebars.VM.noop ? partial.inverse : partial.options['empty-template'],
      'item-view': partial.options['item-view'],
      'empty-view': partial.options['empty-view'],
      filter: partial.options['filter']
    });
    this._view._bindCollection(collection, partial);
    partial.$el.attr(collectionCidAttributeName, collection.cid);
    if (collection.name) {
      partial.$el.attr(collectionNameAttributeName, collection.name);
    }
  }
});

_.extend(View.prototype, {
  setCollectionOptions: function(collection, options) {
    return _.extend({
      fetch: true,
      success: false,
      errors: true
    }, options || {});
  },

  _bindCollection: function(collection, partial) {
    var oldCollection = this.collection;
    if (collection) {
      if (!this._boundCollectionsByCid[collection.cid]) {
        this._boundCollectionsByCid[collection.cid] = collection;
      }
      collection.cid = collection.cid || _.uniqueId('collection');
      partial.options = this.setCollectionOptions(collection, partial.options);
      var collectionEvents = this._events.collection,
          collectionEventCallbacks = [];
      collectionEvents.forEach(function(event) {
        function collectionEventCallback() {
          var args = _.toArray(arguments);
          args.unshift(partial);
          return event[1].apply(this, args);
        }
        collection.on(event[0], collectionEventCallback);
        collectionEventCallbacks.push(collectionEventCallback);
      });
      partial.on('freeze', function() {
        collectionEvents.forEach(function(event, i) {
          collection.off(event[0], collectionEventCallbacks[i]);
        });
        collectionEventCallbacks = [];
      });
      collection.trigger('set', collection, oldCollection);
  
      if (this._shouldFetch(collection, partial.options)) {
        this._loadCollection(collection, partial.options);
      } else {
        //want to trigger built in event handler (render())
        //without triggering event on collection
        onCollectionReset.call(this, partial, collection);
      }
    }
  
    return this;
  },

  _loadCollection: function(collection, options) {
    collection.fetch(options);
  },

  //appendItem(partial, collection, model [,index])
  //appendItem(partial, collection, html_string, index)
  //appendItem(partial, collection, view, index)
  appendItem: function(partial, collection, model, index, options) {
    //empty item
    if (!model) {
      return;
    }

    var item_view, collectionElement = partial.$el;

    options = options || {};

    //if index argument is a view
    if (index && index.el) {
      index = collectionElement.children().indexOf(index.el) + 1;
    }

    //if argument is a view, or html string
    if (model.el || typeof model === 'string') {
      item_view = model;
      model = false;
    } else {
      index = index || collection.indexOf(model) || 0;
      item_view = this.renderItem(partial, model, index, collection);
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
        collectionElement.prepend(item_element);
      } else {
        //use last() as appendItem can accept multiple nodes from a template
        collectionElement.find('[' + modelCidAttributeName + '="' + previous_model.cid + '"]').last().after(item_element);
      }

      appendViews.call(this, item_element);

      if (!options.silent) {
        this.trigger('rendered:item', item_element);
      }
    }
    return item_view;
  }
});

function onCollectionReset(partial, collection) {
  this.renderCollection(partial, collection);
}

function renderCollection(partial, collection) {
  //DEPRECATION: backwards compatibility with < 1.3
  if (!collection) {
    collection = this.collection;
  }
  //end DEPRECATION
  var collectionElement = partial.$el;
  collectionElement.empty();
  if (collection.isEmpty()) {
    collectionElement.attr(collectionEmptyAttributeName, true);
    appendEmpty.call(this, partial, collection);
  } else {
    var collectionOptions = partial.options;
    collectionElement.removeAttr(collectionEmptyAttributeName);
    collection.forEach(function(item, i) {
      if (!collectionOptions.filter || collectionOptions.filter &&
        (typeof collectionOptions.filter === 'string'
            ? this[collectionOptions.filter]
            : collectionOptions.filter).call(this, item, i)
        ) {
        this.appendItem(partial, collection, item, i);
      }
    }, this);
  }
  this.trigger('rendered:collection', collectionElement, collection);
}

function renderEmpty(partial, collection) {
  if (!collection) {
    collection = this.collection;
  }
  var collectionOptions = partial.options,
      context = this.emptyContext();
  if (collectionOptions['empty-view']) {
    var view = this.view(collectionOptions['empty-view'], context);
    if (collectionOptions['empty-template']) {
      view.render(view.renderTemplate(collectionOptions['empty-template'], context));
    } else {
      view.render();
    }
    return view;
  } else {
    var emptyTemplate = collectionOptions['empty-template'];
    if (!emptyTemplate) {
      var name = getViewName.call(this, true);
      if (name) {
        emptyTemplate = this.loadTemplate(name + '-empty', {}, Thorax.registry);
      }
      if (!emptyTemplate) {
        return;
      }
    }
    return this.renderTemplate(emptyTemplate, context);
  }
}

function renderItem(partial, item, i, collection) {
  if (!collection) {
    collection = this.collection;
  }
  var collectionOptions = partial.options;
  if (collectionOptions['item-view']) {
    var view = this.view(collectionOptions['item-view'], {
      model: item
    });
    if (collectionOptions['item-template']) {
      view.render(this.renderTemplate(collectionOptions['item-template'], this.itemContext(item, i)));
    } else {
      view.render();
    }
    return view;
  } else {
    return this.renderTemplate(collectionOptions['item-template'] || getViewName.call(this) + '-item', this.itemContext(item, i));
  }
}

function appendEmpty(partial, collection) {
  var collectionElement = partial.$el;
  collectionElement.empty();
  this.appendItem(partial, collection, this.renderEmpty(partial, collection), 0, {
    silent: true
  });
  this.trigger('rendered:empty', collection);
}

View.registerPartialHelper('empty', function(collection, partial) {
  var empty, noArgument;
  if (arguments.length === 1) {
    partial = collection;
    collection = false;
    noArgument = true;
  }

  function callback(context) {
    if (noArgument) {
      empty = !partial.view.model || (partial.view.model && !partial.view.model.isEmpty());
    } else if (!collection) {
      empty = true;
    } else {
      empty = collection.isEmpty();
    }
    if (empty) {
      partial.view.trigger('rendered:empty', collection);
      return partial.fn(context);
    } else {
      return partial.inverse(context);
    }
  }

  //no model binding is necessary as model.set() will cause re-render
  if (collection) {
    function collectionRemoveCallback() {
      if (collection.length === 0) {
        partial.html(callback(partial.context()));
      }
    }
    function collectionAddCallback() {
      if (collection.length === 1) {
        partial.html(callback(partial.context()));
      }
    }
    function collectionResetCallback() {
      partial.html(callback(partial.context()));
    }
    
    collection.on('remove', collectionRemoveCallback);
    collection.on('add', collectionAddCallback);
    collection.on('reset', collectionResetCallback);

    partial.bind('freeze', function() {
      collection.off('remove', collectionRemoveCallback);
      collection.off('add', collectionAddCallback);
      collection.off('reset', collectionResetCallback);
    });
  }

  partial.html(callback(this));
});

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

_.extend(View.prototype, {
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

_.extend(View.prototype, {
  setCollection: function(collection, options) {
    var old_collection = this.collection;
    if (old_collection) {
      this.freeze(old_collection);
    }
    this.collection = collection;
    this.render();
  },
  renderCollection: renderCollection,
  renderEmpty: renderEmpty,
  renderItem: renderItem,
  emptyContext: function() {},
  itemContext: function(item, i) {
    return item.attributes;
  }
});

View.prototype.template = renderTemplate = View.prototype.renderTemplate;

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

var Router = Backbone.Router.extend({
  view: getView
});

var ViewController = Layout.extend();
_.extend(ViewController.prototype, Router.prototype);
ViewController.prototype.initialize = function() {
  this._bindRoutes();
};

var Model = Backbone.Model.extend({
  isEmpty: function() {
    return this.isPopulated();
  },
  isPopulated: function() {
    // We are populated if we have attributes set
    var attributes = _.clone(this.attributes);
    var defaults = _.isFunction(this.defaults) ? this.defaults() : (this.defaults || {});
    for (var default_key in defaults) {
      if (attributes[default_key] != defaults[default_key]) {
        return true;
      }
      delete attributes[default_key];
    }
    var keys = _.keys(attributes);
    return keys.length > 1 || (keys.length === 1 && keys[0] !== 'id');
  }
});

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

//create the Thorax object
var Thorax;
this.Thorax = Thorax = {
  Layout: Layout,
  View: View,
  Model: Model,
  Collection: Collection,
  Router: Router,
  templatePathPrefix: ''
};

Thorax.registry = {
  templates: {},
  Views: {},
  Mixins: {},
  Models: {},
  Collections: {},
  Routers: {}
};

//if a "name" property is specified during extend set it on the registry
//views need special property inheritence
//routers will be treated as initialized singletons
_.each({
  Model: 'Models',
  Collection: 'Collections',
  View: 'Views',
  Router: 'Routers'
}, function(registryName, className) {
  Thorax[className].extend = function(protoProps, classProps) {
    var child = Backbone[className].extend.call(this, protoProps, classProps);
    if (child.prototype.name) {
      Thorax.registry[registryName][child.prototype.name] = className === 'Router' ? new child : child;
    }
    if (className === 'View') {
      child.mixins = _.clone(this.mixins);
      cloneEvents(this, child, 'events');
      cloneEvents(this.events, child.events, 'model');
      cloneEvents(this.events, child.events, 'collection');
    }
    return child;
  };
});

function cloneEvents(source, target, key) {
  source[key] = _.clone(target[key]);
  //need to deep clone events array
  _.each(source[key], function(value, _key) {
    if (_.isArray(value)) {
      target[key][_key] = _.clone(value);
    }
  });
}

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

Thorax.Application = Layout.extend({
  //will look for application.handlebars, but only if present
  //layout ignores views
  name: 'application',
  initialize: function(options) {
    //DEPRECATION: backwards compatibility with < 1.3
    _.extend(this, Thorax.registry);

    //ensure backbone history has started
    Backbone.history || (Backbone.history = new Backbone.History);
    _.extend(this, {
      Layout: Layout.extend({
        application: this
      }),
      View: View.extend({
        application: this
      }),
      Model: Model.extend({
        application: this
      }),
      Collection: Collection.extend({
        application: this
      }),
      Router: Router.extend({
        application: this
      }),
      ViewController: ViewController.extend({
        application: this
      })
    });

    _.extend(this, options || {});
  },
  start: function(options) {
    this.render();
    if (!Backbone.History.started) {
      Backbone.history.start(options);
    }
    this.trigger('ready', options);
  }
});

//jquery and zepto plugins
_.extend($.fn, {
  view: function() {
    var el = $(this).closest('[' + viewCidAttributeName + ']');
    return (el && _viewsIndexedByCid[el.attr(viewCidAttributeName)]) || false;
  },
  model: function() {
    var $this = $(this),
        modelElement = $this.closest('[' + modelCidAttributeName + ']'),
        modelCid = modelElement && modelElement.attr(modelCidAttributeName);
    if (modelCid) {
      var view = $this.view();
      if (view && view.model && view.model.cid === modelCid) {
        return view.model || false;
      }
      var collection = $this.collection(view);
      if (collection) {
        return collection._byCid[modelCid] || false;
      }
    }
    return false;
  },
  collection: function(view) {
    var $this = $(this),
        collectionElement = $this.closest('[' + collectionCidAttributeName + ']'),
        collectionCid = collectionElement && collectionElement.attr(collectionCidAttributeName);
    if (collectionCid) {
      view = view || $this.view();
      if (view) {
        return view._boundCollectionsByCid[collectionCid];
      }
    }
    return false;
  }
});

}).call(this);
