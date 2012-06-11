//TODO: fix failing nested keyword events 

$(function() {

  var Application = new Thorax.Application();
  Application.start();
  _.extend(Application.templates, {
    'letter.handlebars': Handlebars.compile('{{collection tag="ul"}}'), 
    'letter-item.handlebars': Handlebars.compile("<li>{{letter}}</li>"),
    'letter-empty.handlebars': Handlebars.compile("<li>empty</li>"),
    'letter-multiple-item.handlebars': Handlebars.compile("<li>{{letter}}</li><li>{{letter}}</li>"),
    'parent.handlebars': Handlebars.compile("<div>{{view child}}</div>"),
    'child.handlebars': Handlebars.compile("<div>{{value}}</div>"),
    'form.handlebars': Handlebars.compile('<form><input name="one"/><select name="two"><option value="a">a</option><option value="b">b</option></select><input name="three[four]"/></form>')
  });

  var LetterModel = Application.Model.extend({});

  var letterCollection = new Application.Collection(['a','b','c','d'].map(function(letter) {
    return {letter: letter};
  }));

  var LetterCollectionView = Application.View.extend({
    name: 'letter'
  });

  var LetterItemView = Application.View.extend({
    name: 'letter-item'
  });

  var LetterEmptyView = Application.View.extend({
    name: 'letter-empty'
  });

  test("isPopulated()", function() {
    ok(letterCollection.isPopulated());
    ok(letterCollection.at(0).isPopulated());
  });

  test("_shouldFetch", function() {
    var options = {fetch: true};
    var view = new Application.View();
    var a = new (Application.Model.extend());
    ok(!view._shouldFetch(a, options));

    var b = new (Application.Model.extend({urlRoot: '/'}));
    ok(!!view._shouldFetch(b, options));

    var c = new (Application.Model.extend({urlRoot: '/'}));
    c.set({key: 'value'});
    ok(!view._shouldFetch(c, options));

    var d = new (Application.Collection.extend());
    ok(!view._shouldFetch(d, options));

    var e = new (Application.Collection.extend({url: '/'}));
    ok(!!view._shouldFetch(e, options));
  });

  test("Model View binding", function() {
    var a = new LetterItemView({
      model: letterCollection.at(0)
    });
    equal(a.el.firstChild.innerHTML, 'a', 'set via constructor');

    var b = new LetterItemView();
    b.setModel(letterCollection.at(1));
    equal(b.el.firstChild.innerHTML, 'b', 'set via setModel');

    letterCollection.at(1).set({letter: 'B'});
    equal(b.el.firstChild.innerHTML, 'B', 'update attribute triggers render');

    b.freeze();
    letterCollection.at(1).set({letter: 'b'});
    equal(b.el.firstChild.innerHTML, 'B', 'freeze disables render on update');

    var c = new LetterItemView();
    c.setModel(letterCollection.at(2), {
      render: false
    });
    ok(!c.el.firstChild, 'did not render');
    c.render();
    equal(c.el.firstChild.innerHTML, 'c', 'manual render');
  });

  test("context may be an object", function() {
    var model = new Application.Model({
      a: 'a'
    });
    var view = new (Application.View.extend({
      context: {
        b: 'b',
        c: function() {
          return 'c'
        }
      },
      template: '{{a}}{{b}}{{c}}'
    }));
    view.setModel(model);
    equal(view.html(), 'abc');
  });

  //DEPRECATION: supports syntax for < 1.3
  test("Collection View binding", function() {
    function runCollectionTests(view, indexMultiplier) {
      function matchCids(collection) {
        collection.forEach(function(model) {
          equal(view.$('[data-model-cid="' + model.cid + '"]').length, 1 * indexMultiplier, 'match CIDs');
        });
      }

      ok(!view.el.firstChild, 'no render until setCollection');
      var clonedLetterCollection = new Application.Collection(letterCollection.models),
          renderedItemCount = 0,
          renderedCollectionCount = 0,
          renderedEmptyCount = 0,
          renderedCount = 0;

      view.on('rendered', function() {
        ++renderedCount;
      });
      view.on('rendered:collection', function() {
        ++renderedCollectionCount;
      });
      view.on('rendered:item', function() {
        ++renderedItemCount;
      });
      view.on('rendered:empty', function() {
        ++renderedEmptyCount;
      });

      view.setCollection(clonedLetterCollection);
      equal(view.$('li').length, 4 * indexMultiplier, 'rendered node length matches collection length');
      equal(view.$('li')[0 * indexMultiplier].innerHTML + view.$('li')[3 * indexMultiplier].innerHTML, 'ad', 'rendered nodes in correct order');
      equal(renderedCount, 1, 'rendered event count');
      equal(renderedCollectionCount, 1, 'rendered:collection event count');
      equal(renderedItemCount, 4, 'rendered:item event count');
      equal(renderedEmptyCount, 0, 'rendered:empty event count');
      matchCids(clonedLetterCollection);

      //reorder
      clonedLetterCollection.remove(clonedLetterCollection.at(0));
      equal(view.$('li')[0 * indexMultiplier].innerHTML + view.$('li')[2 * indexMultiplier].innerHTML, 'bd', 'rendered nodes in correct order');
      clonedLetterCollection.remove(clonedLetterCollection.at(2));
      equal(view.$('li')[0 * indexMultiplier].innerHTML + view.$('li')[1 * indexMultiplier].innerHTML, 'bc', 'rendered nodes in correct order');
      clonedLetterCollection.add(new LetterModel({letter: 'e'}));
      equal(view.$('li')[2 * indexMultiplier].innerHTML, 'e', 'collection and nodes maintain sort order');
      clonedLetterCollection.add(new LetterModel({letter: 'a'}), {at: 0});
      equal(view.$('li')[0 * indexMultiplier].innerHTML, 'a', 'collection and nodes maintain sort order');
      equal(renderedCount, 1, 'rendered event count');
      equal(renderedCollectionCount, 1, 'rendered:collection event count');
      equal(renderedItemCount, 6, 'rendered:item event count');
      equal(renderedEmptyCount, 0, 'rendered:empty event count');
      matchCids(clonedLetterCollection);

      //empty
      clonedLetterCollection.remove(clonedLetterCollection.models);
      equal(view.$('li')[0].innerHTML, 'empty', 'empty collection renders empty');
      clonedLetterCollection.add(new LetterModel({letter: 'a'}));
      equal(view.$('li').length, 1 * indexMultiplier, 'transition from empty to one item');
      equal(view.$('li')[0 * indexMultiplier].innerHTML, 'a', 'transition from empty to one item');
      equal(renderedCount, 1, 'rendered event count');
      equal(renderedCollectionCount, 1, 'rendered:collection event count');
      equal(renderedItemCount, 7, 'rendered:item event count');
      equal(renderedEmptyCount, 1, 'rendered:empty event count');
      matchCids(clonedLetterCollection);

      var oldLength = view.$('li').length;
      clonedLetterCollection.reset(clonedLetterCollection.models);
      equal(oldLength, view.$('li').length, 'Reset does not cause change in number of rendered items')

      //freeze
      view.freeze();
      clonedLetterCollection.remove(clonedLetterCollection.models);
      equal(renderedEmptyCount, 1, 'rendered:empty event count');
      equal(view.$('li')[0 * indexMultiplier].innerHTML, 'a', 'transition from empty to one item');
    }

    runCollectionTests(new LetterCollectionView(), 1);

    var viewReturningItemView = new (LetterCollectionView.extend({
      renderItem: function(model, i) {
        return new LetterItemView({model: model});
      }
    }));
    runCollectionTests(viewReturningItemView, 1);

    var viewReturningMixed = new (LetterCollectionView.extend({
      renderItem: function(model, i) {
        return i % 2 === 0 ? new LetterItemView({model: model}) : this.template(this.name + '-item', model.attributes);
      }
    }));
    runCollectionTests(viewReturningMixed, 1);

    var viewReturningMultiple = new (LetterCollectionView.extend({
      renderItem: function(model, i) {
        return this.template('letter-multiple-item', model.attributes);
      }
    }));
    runCollectionTests(viewReturningMultiple, 2);

    var viewWithBlockCollectionHelper = new Application.View({
      template: '{{#collection tag="ul" empty-template="letter-empty"}}<li>{{letter}}</li>{{/collection}}'
    });
    runCollectionTests(viewWithBlockCollectionHelper, 1);

    var viewWithBlockCollectionHelperWithViews = new Application.View({
      template: '{{collection tag="ul" empty-template="letter-empty" item-view="letter-item"}}'
    });
    runCollectionTests(viewWithBlockCollectionHelperWithViews, 1);

    var viewWithBlockCollectionHelperWithViewsAndBlock = new Application.View({
      template: '{{#collection tag="ul" empty-template="letter-empty" item-view="letter-item"}}<li class="testing">{{letter}}</li>{{/collection}}'
    });
    runCollectionTests(viewWithBlockCollectionHelperWithViewsAndBlock, 1);

    var viewWithCollectionHelperWithEmptyView = new Application.View({
      template: '{{collection tag="ul" empty-view="letter-empty" item-template="letter-item"}}'
    });
    runCollectionTests(viewWithCollectionHelperWithEmptyView, 1);

    var viewWithCollectionHelperWithEmptyViewAndBlock = new Application.View({
      template: '{{collection tag="ul" empty-templatve="letter-empty" empty-view="letter-empty" item-template="letter-item"}}'
    });
    runCollectionTests(viewWithCollectionHelperWithEmptyViewAndBlock, 1);
  });

  test("multiple collections", function() {
    var view = new Application.View({
      template: '{{collection a tag="ul" item-template="letter-item"}}{{collection b tag="ul" item-template="letter-item"}}',
      a: new Application.Collection(letterCollection.models),
      b: new Application.Collection(letterCollection.models)
    });
    view.render();
    equal(view.$('li').length, letterCollection.models.length * 2);

    var SubViewWithSameCollection = Application.View.extend({
      name: 'sub-view-with-same-collection',
      template: '{{collection a tag="ul" item-template="letter-item"}}'
    });
    var view = new Application.View({
      a: new Application.Collection(letterCollection.models),
      b: new Application.Collection(letterCollection.models),
      template: '{{collection a tag="ul" item-template="letter-item"}}{{view "sub-view-with-same-collection" a=a}}'
    });
    view.render();
    equal(view.$('li').length, letterCollection.models.length * 2);
  });

  test("inverse block in collection helper", function() {
    var emptyCollectionView = new Application.View({
      template: '{{#collection}}<div>{{letter}}</div>{{else}}<div>empty</div>{{/collection}}',
      collection: new Application.Collection()
    });
    emptyCollectionView.render();
    equal(emptyCollectionView.$('[data-collection-cid]').html(), '<div>empty</div>');
  });

  test("nested collection helper", function() {
    var blogModel = new Application.Model();
    Application.View.extend({
      name: 'Comments',
      template: '{{#collection comments}}<p>{{comment}}</p>{{/collection}}'
    });
    var view = new Application.View({
      template: '{{#empty posts}}empty{{else}}{{#collection posts name="outer"}}<h2>{{title}}</h2>{{view "Comments" comments=comments}}</div>{{/collection}}{{/empty}}',
      model: blogModel
    });
    equal(view.html(), 'empty');
    var comments1 = new Application.Collection([
      new Application.Model({comment: 'comment one'}),
      new Application.Model({comment: 'comment two'})
    ]);
    var comments2 = new Application.Collection([
      new Application.Model({comment: 'comment three'}),
      new Application.Model({comment: 'comment four'})
    ]);
    blogModel.set({
      posts: new Application.Collection([
        new Application.Model({
          title: 'title one',
          comments: comments1
        }),
        new Application.Model({
          title: 'title two',
          comments: comments2
        })
      ])
    });
    equal(view.$('h2').length, 2);
    equal(view.$('h2')[0].innerHTML, 'title one');
    equal(view.$('h2')[1].innerHTML, 'title two');
    equal(view.$('p').length, 4);
    equal(view.$('p')[0].innerHTML, 'comment one');
    equal(view.$('p')[1].innerHTML, 'comment two');
    equal(view.$('p')[2].innerHTML, 'comment three');
    equal(view.$('p')[3].innerHTML, 'comment four');

    comments2.add(new Application.Model({comment: 'comment five'}));
    equal(view.$('p')[4].innerHTML, 'comment five');

    blogModel.attributes.posts.add(new Application.Model({
      title: 'title three'
    }));
    equal(view.$('h2').length, 3);
    equal(view.$('h2')[2].innerHTML, 'title three');
  });

  test("graceful failure of empty collection with no empty template", function() {
    var view = new Application.View({
      template: '{{collection item-template="letter-item"}}',
      collection: new Application.Collection({
        isPopulated: function() {
          return true;
        }
      })
    });
    view.render();
    view = new Application.View({
      template: '{{collection item-template="letter-item"}}',
      collection: new Application.Collection
    });
    view.render();
    ok(true);
  });

  test("empty helper", function() {
    var emptyView = new Application.View({
      template: '{{#empty}}empty{{else}}not empty{{/empty}}'
    });
    emptyView.render();
    equal(emptyView.html(), 'empty');
    var emptyModelView = new Application.View({
      template: '{{#empty}}empty{{else}}not empty{{/empty}}',
      model: new Application.Model()
    });
    emptyModelView.render();
    equal(emptyModelView.html(), 'empty');
    emptyModelView.model.set({key: 'value'});
    equal(emptyModelView.html(), 'not empty');
    var emptyCollectionView = new Application.View({
      template: '{{#empty myCollection}}empty{{else}}not empty{{/empty}}',
      myCollection: new Application.Collection()
    });
    emptyCollectionView.render();
    equal(emptyCollectionView.html(), 'empty');
    var model = new Application.Model();
    emptyCollectionView.myCollection.add(model);
    equal(emptyCollectionView.html(), 'not empty');
    emptyCollectionView.myCollection.remove(model);
    equal(emptyCollectionView.html(), 'empty');
  });

  test("child views", function() {
    var childRenderedCount = 0,
        parentRenderedCount = 0;
    var Child = Application.View.extend({
      name: 'child',
      events: {
        rendered: function() {
          ++childRenderedCount;
        }
      }
    });
    var Parent = Application.View.extend({
      name: 'parent',
      events: {
        rendered: function() {
          ++parentRenderedCount;
        }
      },
      initialize: function() {
        this.childModel = new Application.Model({
          value: 'a'
        });
        this.child = this.view('child', {
          model: this.childModel
        });
      }
    });
    var parent = new Parent();
    parent.render();
    equal(parent.$('[data-view-name="child"] > div').html(), 'a', 'view embedded');
    equal(parentRenderedCount, 1);
    equal(childRenderedCount, 1);
  
    parent.render();
    equal(parent.$('[data-view-name="child"] > div').html(), 'a', 'view embedded');
    equal(parentRenderedCount, 2, 're-render of parent does not render child');
    equal(childRenderedCount, 1, 're-render of parent does not render child');
  
    parent.childModel.set({value: 'b'});
    equal(parent.$('[data-view-name="child"] > div').html(), 'b', 'view embedded');
    equal(parentRenderedCount, 2, 're-render of child does not parent child');
    equal(childRenderedCount, 2, 're-render of child does not render parent');
  
    //ensure recursion does not happen when child view has the same model
    //as parent
    parent.setModel(parent.childModel);
    parent.model.set({value: 'c'});
    equal(parentRenderedCount, 4);
    equal(childRenderedCount, 3);
  });

  test("Pass a function or view class to view()", function() {
    var Child = Application.View.extend({
      isChild: true
    });
    var parent = new Application.View();
    ok(parent.view(Child).isChild);
    equal(parent.view(Child, {key: 'value'}).key, 'value');
    equal(parent.view(function() {
      return new Child({key: 'value'});
    }).key, 'value');
  });

  test("helper and local scope collision", function() {
    var child = new Application.View({
      collection: letterCollection,
      template: '{{#collection this.collection tag="ul"}}<li>{{letter}}</li>{{/collection}}'
    });
    child.render();
    equal(child.$('li').html(), 'a');
  });
  
  test("local view functions are called in template scope", function() {
    var child = new Application.View({
      template: '{{key "value"}}',
      key: function(value) {
        return value;
      }
    });
    child.render();
    equal('value', child.html());
  });

  test("template not found handling", function() {
    var view = new Application.View();
    equal('', view.template('foo', {}, true));
    raises(function() {
      view.template('foo');
    });
  });
  
  test("render() subclassing", function() {
    var a = new Application.View({
      render: function() {
        Application.View.prototype.render.call(this, '<p>a</p>');
      }
    });
    a.render();

    var b = new Application.View({
      render: function() {
        Application.View.prototype.render.call(this, $('<p>b</p>'));
      }
    });
    b.render();

    var c = new Application.View({
      render: function() {
        var el = document.createElement('p');
        el.innerHTML = 'c';
        Application.View.prototype.render.call(this, el);
      }
    });
    c.render();

    var d = new Application.View({
      render: function() {
        var view = new Application.View({
          render: function() {
            Application.View.prototype.render.call(this, '<p>d</p>');
          }
        });
        view.render();
        Application.View.prototype.render.call(this, view);
      }
    });
    d.render();

    equal(a._renderCount, 1, '_renderCount incrimented');
    equal(b._renderCount, 1, '_renderCount incrimented');
    equal(c._renderCount, 1, '_renderCount incrimented');
    equal(d._renderCount, 1, '_renderCount incrimented');
    equal(a.$('p').html(), 'a', 'parent render accepts string');
    equal(b.$('p').html(), 'b', 'parent render accepts dom array');
    equal(c.$('p').html(), 'c', 'parent render accepts dom element');
    equal(d.$('p').html(), 'd', 'parent render accepts view');
  });

  test("template passed to constructor and view block", function() {
    var view = new Application.View({
      template: '<p>{{key}}</p>',
      key: 'value'
    });
    view.render();
    equal(view.$('p').html(), 'value');

    var view = new (Application.View.extend({
      template: '<p>{{key}}</p>',
      key: 'value'
    }));
    view.render();
    equal(view.$('p').html(), 'value');

    var Child = Application.View.extend({
      template: '<div class="child-a">{{key}}</div>',
      key: 'value'
    });

    var a = new Child;
    var b = new Child;

    var parent = new Application.View({
      template: '<div class="parent">{{#view b}}<div class="child-b">{{key}}</div>{{/view}}{{view a}}</div>',
      a: a,
      b: b
    });
    parent.render();
    equal(parent.$('.child-a').html(), 'value');
    equal(parent.$('.child-b').html(), 'value');

    //ensure that override does not persist to view itself
    b.render();
    equal(b.$('.child-a').html(), 'value');

    //test nesting
    var outer = new Application.View({
      template: '<div class="a">{{#view inner}}<div class="b">{{#view child}}<div class="c">value</div>{{/view}}</div>{{/view}}</div>',
      inner: new Application.View({
        child: new Application.View
      })
    });
    outer.render();
    equal(outer.$('.c').html(), 'value');
  });
  
  test("Inheritable events", function() {
    var Parent = Application.View.extend({}),
        aCount = 0,
        bCount = 0;
    Parent.registerEvents({
      a: function() {
        ++aCount;
      }
    });
    var Child = Parent.extend({});
    Child.registerEvents({
      b: function() {
        ++bCount;
      }
    });
    var parent = new Parent(),
        child = new Child();
    parent.trigger('a');
    parent.trigger('b');
    child.trigger('a');
    child.trigger('b');
    equal(aCount, 2);
    equal(bCount, 1);
  
    //ensure events are properly cloned
    Parent = Application.View.extend();
    Parent.registerEvents({
      a: 1
    });
  
    Child = Parent.extend({});
    Child.registerEvents({
      a: 2
    });
    
    var ChildTwo = Parent.extend({});
  
    equal(Child.events.a[0], 1, 'ensure events are not shared between children');
    equal(Child.events.a.length, 2, 'ensure events are not shared between children');
    equal(ChildTwo.events.a[0], 1, 'ensure events are not shared between children');
    equal(ChildTwo.events.a.length, 1, 'ensure events are not shared between children');
  });

  test("multiple event registration", function() {
    var view = new Application.View(), a = 0, b = 0, c = 0, d = 0, e = 0;
    view.registerEvents({
      'a,b': function() {
        ++a;
        ++b;
      },
      'c': [
        function() {
          ++c;
        },
        function() {
          ++c;
        }
      ],
      'd,e': [
        function() {
          ++d;
        },
        function() {
          ++e;
        }
      ]
    });
    view.trigger('a');
    view.trigger('b c');
    view.trigger('d e');
    equal(a, 2);
    equal(b, 2);
    equal(c, 2);
    equal(d, 2);
    equal(e, 2);
  });
    
  test("dom events and containHandlerToCurrentView", function() {
    this.clock.restore();
    var childClickedCount = 0,
        parentClickedCount = 0;
    
    var Child = Application.View.extend({
      name: 'child',
      events: {
        'click div': function() {
          ++childClickedCount;
        }
      }
    });
    
    var Parent = Application.View.extend({
      name: 'parent',
      events: {
        'click div': function() {
          ++parentClickedCount;
        }
      },
      initialize: function() {
        this.child = this.view('child', {
          value: 'a'
        });
      }
    });
    
    var parent = new Parent();
    parent.render();
    document.body.appendChild(parent.el);
  
    expect(4);
    stop();
    setTimeout(function() {
      $(parent.$('div')[0]).trigger('click');
      equal(parentClickedCount, 1);
      equal(childClickedCount, 0);
      
      parent.child.$('div').trigger('click');
      equal(parentClickedCount, 1);
      equal(childClickedCount, 1);
      $(parent.el).remove();
      start();
    }, 2);
  });
  
  test("serialize() / populate()", function() {
    var FormView = Application.View.extend({
      name: 'form'
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
  
  test("Test thorax layout", function() {
    var a = new Application.View({
      render: function() {
        Application.View.prototype.render.call(this, 'a');
      }
    });
    var aEventCounter = {};
    a.bind('all', function(eventName) {
      aEventCounter[eventName] || (aEventCounter[eventName] = 0);
      ++aEventCounter[eventName];
    });
  
    var b = new Application.View({
      render: function() {
        Application.View.prototype.render.call(this, 'b');
      }
    });
    var bEventCounter = {};
    b.bind('all', function(eventName) {
      bEventCounter[eventName] || (bEventCounter[eventName] = 0);
      ++bEventCounter[eventName];
    });
  
    ok(!Application.view, 'layout does not start with a view');
  
    Application.setView(a);
    equal(Application.view, a, 'layout sets view');
    ok(Application.$('[data-view-name]').length, 'layout updates HTML')
  
    b.render();
    Application.setView(b);
    equal(Application.view, b, 'layout sets view');
  
    //lifecycle checks
    equal(aEventCounter.rendered, 1);
    equal(aEventCounter.activated, 1);
    equal(aEventCounter.ready, 1);
    equal(aEventCounter.deactivated, 1);
    equal(aEventCounter.destroyed, 1);
  
    equal(bEventCounter.rendered, 1);
    equal(bEventCounter.activated, 1);
    equal(bEventCounter.ready, 1);
    ok(!bEventCounter.deactivated);
    ok(!bEventCounter.destroyed);

    Application.setView(false);
    ok(!Application.view, 'layout can set to empty view');
    equal(bEventCounter.rendered, 1);
    equal(bEventCounter.activated, 1);
    equal(bEventCounter.ready, 1);
    equal(bEventCounter.deactivated, 1);
    equal(bEventCounter.destroyed, 1);
  });

  test("nested layouts", function() {
    var application = new Thorax.Application;
    var linkView = application.View.extend({
      template: '<a href="#index">index</a>'
    });
    var view = new application.View({
      template: '{{view layoutView}}{{view linkView}}',
      initialize: function() {
        this.layoutView = new application.Layout;
        this.nestedLinkView = new linkView;
        this.layoutView.setView(this.nestedLinkView);
        this.linkView = new linkView;
      }
    });
    application.setView(view);
    document.body.appendChild(application.el);
    var callCount = 0;
    var router = new (application.Router.extend({
      routes: {
        'index': 'index'
      },
      index: function() {
        ++callCount;
      }
    }));
    Backbone.history.navigate('', {trigger: false});
    equal(callCount, 0);
    var outerLink = view.$('a')[0];
    var click = $.Event('click');
    click.currentTarget = outerLink;
    $(outerLink).trigger(click);
    equal(callCount, 1);
    Backbone.history.navigate('', {trigger: false});
    var innerLink = view.nestedLinkView.$('a')[0];
    click = $.Event('click');
    click.currentTarget = innerLink;
    $(innerLink).trigger(click);
    equal(callCount, 2);
    document.body.removeChild(application.el);
  });

  test("$.fn.view, $.fn.model, $.fn.collection", function() {
    var child = new Application.View({
      template: '{{#collection letters tag="ul"}}<li>{{letter}}</li>{{/collection}}',
      letters: letterCollection
    });
    child.render();
    equal(child.$('li:first-child').view(), child);
    equal(child.$('ul').collection(), letterCollection);
    equal(child.$('ul').model(), false);
    equal(child.$el.collection(), false);
    equal(child.$('li:first-child').collection(), letterCollection);
    equal(child.$('li:first-child').model(), letterCollection.models[0]);

    var parent = new Application.View({
      model: new Application.Model(),
      template: '{{view child}}',
      child: child
    });
    parent.render();
    equal(child.$('ul').model(), false);
    equal($('ul', child.el).model(), false);
    equal(parent.$el.model(), parent.model);
  });

});
