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
