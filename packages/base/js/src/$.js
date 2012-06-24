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
