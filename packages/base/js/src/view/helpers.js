_.extend(View, {
  registerHelper: function(name, callback) {
    this[name] = callback;
    Handlebars.registerHelper(name, this[name]);
  },
  registerPartialHelper: function(name, callback) {
    return View.registerHelper(name, function() {
      var args = _.toArray(arguments),
          options = args.pop(),
          cid = _.uniqueId('partial'),
          partial = new Partial(cid, this._view, options);
      args.push(partial);
      this._view._partials.push(partial);
      var htmlAttributes = _.extend({}, options.hash);
      htmlAttributes[partialCidAttributeName] = cid;
      return new Handlebars.SafeString(View.tag(htmlAttributes, callback.apply(this, args)));
    });
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
      console.log('here',partial,partial.view);
      partial.view.trigger('rendered:empty', collection);
      return partial.fn(context);
    } else {
      return partial.inverse(context);
    }
  }

  if (arguments.length === 2 && collection) {
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
    collection.on('remove', collectionRemoveCallback);
    collection.on('add', collectionAddCallback);
    partial.bind('destroyed', function() {
      collection.off('remove', collectionRemoveCallback);
      collection.off('add', collectionAddCallback);
    });
  }

  return callback(this);
});

View.registerHelper('url', function(url) {
  return (Backbone.history._hasPushState ? Backbone.history.options.root : '#') + url;
});

View.registerHelper('layout', function(options) {
  options.hash[layoutCidAttributeName] = this._view.cid;
  return new Handlebars.SafeString(View.tag.call(this, options.hash, null, this));
});
