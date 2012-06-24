ViewPrototype.mixin = function(name) {
  if (!this._appliedMixins) {
    this._appliedMixins = [];
  }
  if (this._appliedMixins.indexOf(name) == -1) {
    this._appliedMixins.push(name);
    if (typeof name === 'function') {
      name.call(this);
    } else {
      var mixin = Thorax.registry.Mixins[name];
      _.extend(this, mixin[1]);
      //mixin callback may be an array of [callback, arguments]
      if (_.isArray(mixin[0])) {
        mixin[0][0].apply(this, mixin[0][1]);
      } else {
        mixin[0].apply(this, _.toArray(arguments).slice(1));
      }
    }
  }
};

View.registerMixin = function(name, callback, methods) {
  Thorax.registry.Mixins[name] = [callback, methods];
};

View.mixins = [];

View.mixin = function(mixin) {
  this.mixins.push(mixin);
};

function applyMixin(mixin) {
  if (_.isArray(mixin)) {
    this.mixin.apply(this, mixin);
  } else {
    this.mixin(mixin);
  }
}
