var errorClassName = 'error',
    errorAttributeName = 'data-view-error',
    inputErrorAttributeName = 'data-input-error-id';

Thorax.View.registerPartialHelper('error', function(partial) {
  if (!partial.el.className || partial.el.className === '') {
    partial.$el.addClass('alert alert-error');
  }
  partial.$el.attr(errorAttributeName, 'true');

  function invokeFn(errors) {
    partial.html(partial.fn(partial.context({
      errors: errors
    })));
    partial.$el.show();
  }

  function invokeInverse(scope) {
    partial.html(partial.inverse(scope || partial.context()));
    partial.$el.hide();
  }

  partial.view.on('error', invokeFn);
  partial.view.on('serialize', invokeInverse);
  partial.on('freeze', function() {
    partial.view.off('error', invokeFn);
    partial.view.off('serialize', invokeInverse);
  });

  invokeInverse(this);
});

Thorax.View.registerHelper('input-error', function(forInputId, options) {
  options.hash.tag = options.hash.tag || 'span';
  options.hash['class'] = options.hash['class'] || 'help-inline';
  options.hash[inputErrorAttributeName] = forInputId;
  return new Handlebars.SafeString(Thorax.View.tag(options.hash));
});

Thorax.View.registerHelper('input', function(options) {
  var content = null,
      inputGenerator,
      labelGenerator,
      inputErrorMessageGenerator,
      id;
  options.hash.tag = 'input';
  id = options.hash.id = options.hash.id || ((options.hash.name || _.uniqueId('input')) + '-' + this.cid);

  if (options.hash.label && !options.hash.placeholder) {
    options.hash.placeholder = options.hash.label;
  }
  
  if (options.hash.label) {
    var label = options.hash.label;
    labelGenerator = function(generatorOptions) {
      return Thorax.View.tag(_.extend({
        tag: 'label',
        'for': options.hash.id,
        'class': 'control-label'
      }, generatorOptions ? generatorOptions.hash : {}), label, this);
    };
    delete options.hash.label;
  }

  inputErrorMessageGenerator = function(generatorOptions) {
    var inputErrorMessageOptions = {
      tag: 'p',
      'class': 'help-block',
    };
    inputErrorMessageOptions[inputErrorAttributeName] = id;
    return Thorax.View.tag(_.extend(inputErrorMessageOptions, generatorOptions ? generatorOptions.hash : {}));
  };

  if (options.hash.type === 'textarea') {
    content = options.hash.value || '';
    options.hash.tag = 'textarea';
    delete options.hash.value;
    delete options.hash.type;
  } else if (options.hash.type === 'select') {
    options.hash.tag = 'select';
    var selectOptions = options.hash.options || [];
    if (!_.isArray(selectOptions)) {
      selectOptions = _.map(selectOptions, function(label, value) {
        return {
          value: value,
          label: label,
          selected: value == options.hash.selected
        }
      }, this);
    }
    content = _.map(selectOptions, function(option) {
      var tagOptions = {
        tag: 'option',
        value: option[0] || option.value
      };
      if (option.selected) {
        tagOptions.selected = selected;
      }
      return Thorax.View.tag(tagOptions, option[1] || option.label, this);
    }, this).join('');
    delete options.hash.type;
    delete options.hash.options;
    delete options.hash.selected;
  } else if (!options.hash.type) {
    options.hash.type = 'text';
  }
  inputGenerator = function(generatorOptions) {
    var output = Thorax.View.tag(_.extend({}, options.hash, generatorOptions ? generatorOptions.hash : {}), content, this);
    return output;
  };

  var returnObjects = options.hash['return-objects'];
  delete options.hash['return-objects'];

  if (returnObjects) {
    return {
      'control-input': function() {
        return new Handlebars.SafeString(inputGenerator.apply(this, arguments));
      },
      'control-label': function() {
        if (!labelGenerator) {
          return '';
        }
        return new Handlebars.SafeString(labelGenerator.apply(this, arguments));
      },
      'control-error': function() {
        return new Handlebars.SafeString(inputErrorMessageGenerator.apply(this, arguments));
      }
    };
  } else {
    return new Handlebars.SafeString(
      (labelGenerator ? labelGenerator.call(this) : '') +
      (inputErrorMessageGenerator ? inputErrorMessageGenerator.call(this) : '') +
      (inputGenerator ? inputGenerator.call(this) : '')
    );
  }
});

Thorax.View.registerHelper('control-group', function(options) {
  var generators = Handlebars.helpers.input.call(this, {
    hash: {
      'return-objects': true,
      name: options.hash.name,
      label: options.hash.label
    }
  });
  delete options.hash.name;
  delete options.hash.label;
  options.hash['class'] = options.hash['class'] || 'control-group';
  var context = _.extend({}, this, generators);
  return new Handlebars.SafeString(Thorax.View.tag(options.hash, options.fn(context), this));
});

function resetErrorState() {
  this.$('[' + inputErrorAttributeName + ']').empty().hide();
  this.$('.control-group.' + errorClassName).removeClass(errorClassName);
}

_.extend(Thorax.View.prototype, {
  reset: function() {
    _.each(this.$('form'), function(form) {
      form.reset();
    });
    resetErrorState.call(this);
  }
});

Thorax.View.registerEvents({
  rendered: resetErrorState,
  serialize: resetErrorState,
  error: function(errors) {
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
