Application.Router.extend({
  name: module.name,
  routes: module.routes,
  index: function() {
    var view = this.view('hello-world/index');
    Application.setView(view);
  }
});
