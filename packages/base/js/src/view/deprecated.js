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
