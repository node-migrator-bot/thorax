var Application = new Thorax.Application;

$(function() {
  document.body.appendChild(Application.el);
});

Application.setView(new Thorax.View({
  template: 'Hello World!'
}));
