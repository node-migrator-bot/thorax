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
