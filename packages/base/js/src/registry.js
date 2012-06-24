Thorax.registry = {
  templates: {},
  Views: {},
  Mixins: {},
  Models: {},
  Collections: {},
  Routers: {}
};

//if a "name" property is specified during extend set it on the registry
//views need special property inheritence
//routers will be treated as initialized singletons
_.each({
  Model: 'Models',
  Collection: 'Collections',
  View: 'Views',
  Router: 'Routers'
}, function(registryName, className) {
  Thorax[className].extend = function(protoProps, classProps) {
    var child = Backbone[className].extend.call(this, protoProps, classProps);
    if (child.prototype.name) {
      Thorax.registry[registryName][child.prototype.name] = className === 'Router' ? new child : child;
    }
    if (className === 'View') {
      child.mixins = _.clone(this.mixins);
      cloneEvents(this, child, 'events');
      cloneEvents(this.events, child.events, 'model');
      cloneEvents(this.events, child.events, 'collection');
    }
    return child;
  };
});

function cloneEvents(source, target, key) {
  source[key] = _.clone(target[key]);
  //need to deep clone events array
  _.each(source[key], function(value, _key) {
    if (_.isArray(value)) {
      target[key][_key] = _.clone(value);
    }
  });
}
