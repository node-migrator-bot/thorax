internalViewEvents.collection = {
  add: function(model, collection) {
    var collection_element = this._getCollectionElement(collection),
        collectionOptions = this._collectionOptionsByCid[collection.cid];
    if (collection.length === 1) {
      if(collection_element.length) {
        //note that this is $.empty() and not renderEmpty or other collection functionality
        collection_element.removeAttr(collectionEmptyAttributeName);
        collection_element.empty();
      }
      if (collectionOptions.renderOnEmptyStateChange) {
        this.render();
      }
    }
    if (collection_element.length) {
      var index = collection.indexOf(model);
      if (!collectionOptions.filter || collectionOptions.filter &&
        (typeof collectionOptions.filter === 'string'
            ? this[collectionOptions.filter]
            : collectionOptions.filter).call(this, model, index)
        ) {
        this.appendItem(collection, model, index, {
          collectionElement: collection_element
        });
      }
    }
  },
  remove: function(model, collection) {
    var collection_element = this._getCollectionElement(collection);
    collection_element.find('[' + modelCidAttributeName + '="' + model.cid + '"]').remove();
    for (var cid in this._views) {
      if (this._views[cid].model && this._views[cid].model.cid === model.cid) {
        this._views[cid].destroy();
        delete this._views[cid];
        break;
      }
    }
    if (collection.length === 0) {
      if (collection_element.length) {
        collection_element.attr(collectionEmptyAttributeName, true);
        appendEmpty.call(this, collection);
      }
      if (this._collectionOptionsByCid[collection.cid].renderOnEmptyStateChange) {
        this.render();
      }
    }
  },
  reset: function(collection) {
    onCollectionReset.call(this, collection);
  },
  error: function(collection, message) {
    if (this._collectionOptionsByCid[collection.cid].errors) {
      this.trigger('error', message);
    }
  }
};

_.extend(View.prototype, {
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
  }
});

function ensureCollectionIsBound(collection, options) {
  if (!this._boundCollectionsByCid[collection.cid]) {
    this.bindCollection(collection, options);
  } else if (options) {
    _.extend(this._collectionOptionsByCid[collection.cid], options);
  }
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

function appendEmpty(collection) {
  var collection_element = this._getCollectionElement(collection).empty();
  this.appendItem(collection, this.renderEmpty(collection), 0, {
    silent: true,
    collectionElement: collection_element
  });
  this.trigger('rendered:empty', collection);
}
