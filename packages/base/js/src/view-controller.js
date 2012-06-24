var ViewController = Layout.extend();
_.extend(ViewController.prototype, Router.prototype);
ViewController.prototype.initialize = function() {
  this._bindRoutes();
};
