Thorax.templatePathPrefix = 'templates/';
module.exports = exports = new Thorax.Application(exports);
$(document).ready(function() {
  $('body').append(exports.el);
  if (exports && exports.initBackboneLoader) {
    exports.initBackboneLoader();
  }
  exports.start({
    pushState: false,
    root: '/'
  });
});
