$(function() {

  var Application = new Thorax.Application();

  test("serialize() / populate()", function() {
    var FormView = Application.View.extend({
      name: 'form',
      template: '<form><input name="one"/><select name="two"><option value="a">a</option><option value="b">b</option></select><input name="three[four]"/></form>'
    });
  
    var model = new Application.Model({
      one: 'a',
      two: 'b',
      three: {
        four: 'c'
      }
    });
  
    var view = new FormView();
    view.render();
    var attributes = view.serialize();
    equal(attributes.one, "", 'serialize empty attributes');
    view.setModel(model);

    attributes = view.serialize();

    equal(attributes.one, 'a', 'serialize attributes from model');
    equal(attributes.two, 'b', 'serialize attributes from model');
    equal(attributes.three.four, 'c', 'serialize attributes from model');
  
    view.populate({
      one: 'aa',
      two: 'b',
      three: {
        four: 'cc'
      }
    });

    attributes = view.serialize();
    equal(attributes.one, 'aa', 'serialize attributes from populate()');
    equal(attributes.two, 'b', 'serialize attributes from populate()');
    equal(attributes.three.four, 'cc', 'serialize attributes from populate()');
  
    view.validateInput = function() {
      return ['error'];
    };
    var errorCallbackCallCount = 0;
    view.bind('error', function() {
      ++errorCallbackCallCount;
    });
    ok(!view.serialize());
    equal(errorCallbackCallCount, 1, "error event triggered when validateInput returned errors");
  });
});
