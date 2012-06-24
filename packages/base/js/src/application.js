Thorax.Application = Layout.extend({
  //will look for application.handlebars, but only if present
  //layout ignores views
  name: 'application',
  initialize: function(options) {
    //DEPRECATION: backwards compatibility with < 1.3
    _.extend(this, Thorax.registry);

    //ensure backbone history has started
    Backbone.history || (Backbone.history = new Backbone.History);
    _.extend(this, {
      Layout: Layout.extend({
        application: this
      }),
      View: View.extend({
        application: this
      }),
      Model: Model.extend({
        application: this
      }),
      Collection: Collection.extend({
        application: this
      }),
      Router: Router.extend({
        application: this
      }),
      ViewController: ViewController.extend({
        application: this
      })
    });

    _.extend(this, options || {});
  },
  start: function(options) {
    this.render();
    if (!Backbone.History.started) {
      Backbone.history.start(options);
    }
    this.trigger('ready', options);
  }
});
