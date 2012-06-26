internalViewEvents.collection = {
  add: function(partial, model, collection) {
    var collectionElement = partial.$el,
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
