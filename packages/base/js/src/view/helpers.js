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

