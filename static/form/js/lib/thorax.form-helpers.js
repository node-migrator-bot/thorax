/*

TODO:

- input
- error
- attribute-error
- label
- control-group

{{#control-group}}
  {{label}}
  {{attribute-error}}
  {{input}}
{{/control-group}}


FormView = new Application.View
  events:
    'submit form': (event) ->
      @serialize event, (attributes, release) ->
        @$('form').append '<div></div>'
  template: """
    <form class="form-vertical">
      {{#error}}{{errors}}{{/error}}
      <fieldset>
        {{}}
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Save changes</button>
          <button class="btn">Cancel</button>
        </div>
      </fieldset>
    </form>
  """

*/

var errorClassName = 'error',
    errorAttributeName = 'data-view-error',
    inputErrorAttributeName = 'data-input-error-id';

Thorax.View.registerHelper('error', function(options) {
  var partialId = _.uniqueId('error-');
  this._view[partialId] = function(options) {
    return options.fn(_.extend({}, this, {
      errors: options.hash.errors
    }));
  };
  options.hash['class'] = options.hash['class'] || 'alert alert-error',
  options.hash[errorAttributeName] = 'true';
  return Handlebars.helpers.partial.call(this, partialId, {
    fn: options.fn,
    hash: _.extend({
      anonymous: true
    }, options.hash)
  });
});

Thorax.View.registerHelper('input-error', function(forInputId, options) {
  options.hash['class'] = options.hash['class'] || 'help-inline';
  options.hash[inputErrorAttributeName] = forInputId;
  return new Handlebars.SafeString(Thorax.View.tag(options.hash));
});

Thorax.View.registerHelper('input', function(options) {
  var tag = 'input',
      content = null,
      inputGenerator,
      labelGenerator,
      inputErrorMessageGenerator,
      id;
  id = options.hash.id = options.hash.id || ((options.hash.name || _.uniqueId('input')) + '-' + this.cid);
  options.hash.placeholder = options.hash.placeholder || options.hash.label;
  
  if (options.hash.label) {
    labelGenerator = function(generatorOptions) {
      return Thorax.View.tag(_.extend({
        tag: 'label',
        'for': options.hash.id,
        'class': 'control-label'
      }, generatorOptions ? generatorOptions.hash : {}));
    };
    delete options.hash.label;
  }

  if (!('error-message' in options.hash) || options.hash['error-message']) {
    if (options.hash['error-message']) {
      options.hash['data-error-message'] = options.hash['error-message'];
      delete options.hash['error-message'];
    }
    inputErrorMessageGenerator = function(generatorOptions) {
      var inputErrorMessageOptions = {
        tag: 'p',
        'class': 'help-block',
      };
      inputErrorMessageOptions[inputErrorAttributeName] = id;
      return Thorax.View.tag(_.extend(inputErrorMessageOptions, generatorOptions ? generatorOptions.hash : {}));
    };
  }

  if (options.hash.type === 'textarea') {
    content = '';
    tag = 'textarea';
    delete options.hash.type;
  } else if (options.hash.type === 'select') {
    var options = options.hash.options || [];
    if (!_.isArray(options)) {
      options = _.map(options, function(value, key) {
        return {
          value: value,
          label: key,
          selected: value == options.hash.selected
        }
      }, this);
    }
    content = _.map(options, function(option) {
      var tagOptions = {
        tag: 'option',
        value: options.value
      };
      if (option.selected) {
        tagOptions.selected = selected;
      }
      return Thorax.View.tag(tagOptions, option.label, this);
    }, this).join('');
    delete options.hash.type;
    delete options.hash.options;
    delete options.hash.selected;
  }
  inputGenerator = function(generatorOptions) {
    return Thorax.View.tag(_.extend({}, options.hash, generatorOptions ? generatorOptions.hash : {}), content, this);
  };

  var returnObjects = options.hash['return-objects'];
  delete options.hash['return-objects'];

  if (returnObjects) {
    return {
      input: function() {
        return new Handlebars.SafeString(inputGenerator.apply(this, arguments));
      },
      label: function() {
        return new Handlebars.SafeString(labelGenerator.apply(this, arguments));
      },
      'input-error': function() {
        return new Handlebars.SafeString(inputErrorMessageGenerator.apply(this, arguments));
      }
    };
  } else {
    return new Handlebars.SafeString(labelGenerator.call(this) + inputErrorMessageGenerator.call(this) + inputGenerator.call(this));
  }
});

Thorax.View.registerHelper('control-group', function(options) {
  var generators = Handlebars.helpers.input({
    hash: {
      'return-objects': true,
      name: options.hash.name,
      label: options.hash.label
    }
  });
  delete options.hash.name;
  delete options.hash.label;
  var context = _.extend({}, this, {
    input: generators.input,
    label: generators.label,
    'input-error': generators['input-error']
  });
  return new Handlebars.SafeString(Thorax.View.tag(options.hash, options.fn(context), this));
});


/*

{{control-group label="Text Input" type="text" name="mine"}}

{{#control-group}}
  {{#label for="{{id}}"}}Text Input{{/label}}
  {{input type="text" id="{{id}}"}}

{{/control-group}}

*/
//<div class="control-group">
//      <label class="control-label" for="input01">Text input</label>
//      <div class="controls">
//        <input type="text" class="input-xlarge" id="input01">
//        <p class="help-block">Supporting help text</p>
//      </div>
//    </div>
//

function resetErrorState() {
  this.$('[' + errorAttributeName + ']').empty().hide();
  this.$('[' + inputErrorAttributeName + ']').empty().hide();
  this.$('.control-group.' + errorClassName).removeClass(errorClassName);
}

Thorax.View.registerEvents({
  rendered: resetErrorState,
  serialize: resetErrorState,
  error: function(errors) {
    var $error = this.$('[' + errorAttributeName + ']');
    _.each($error, function(el) {
      var partialName = $(el).attr('data-partial-name');
      this[partialName]({
        errors: errors
      });
    }, this);
    $error.show();
    errors.forEach(function(error) {
      var errorAttributeEl = this.$('[' + inputErrorAttributeName + '="' + error.id + '"]');
      errorAttributeEl.html(error.message);
      errorAttributeEl.show();
      if (error && error.element) {
        error.element.closest('.control-group').addClass(errorClassName);
      }
    }, this);
  }
});
