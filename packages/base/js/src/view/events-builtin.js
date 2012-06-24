var internalEvents = {
  'initialize:after': function(options) {
    //bind model or collection if passed to constructor
    if (options && options.model) {
      this.setModel(options.model);
    }
  },
  model: {
    error: function(model, errors){
      if (this._modelOptions.errors) {
        this.trigger('error', errors);
      }
    },
    change: function() {
      this._onModelChange();
    }
  },
  collection: {
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
  }
};
internalEvents['click [' + callMethodAttributeName + ']'] = function(event) {
  var target = $(event.target);
  event.preventDefault();
  this[target.attr(callMethodAttributeName)].call(this, event);
};
View.registerEvents(internalEvents);
