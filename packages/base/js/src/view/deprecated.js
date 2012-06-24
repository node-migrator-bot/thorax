_.extend(View.prototype, {
  setCollection: function(collection, options) {
    this.collection = collection;
    this.bindCollection(collection, options);
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
