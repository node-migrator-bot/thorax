/*

  
{{#error}}
  error
{{/error}}

{{input-error for="id"}}


*/
var errorClassName = 'error',
    errorAttributeName = 'data-view-error',
    inputErrorAttributeName = 'data-input-error-id';

Thorax.View.registerHelper('error', function(options) {
  var tag = options.hash.tag || options.hash.tagName || 'div';
  delete options.hash.tag;
  delete options.hash.tagName;
  options.hash['class'] = options.hash['class'] || 'alert alert-error',
  options.hash[errorAttributeName] = 'true';
  return new Handlebars.SafeString(View.tag(options.hash, options.fn(this)));
});

Thorax.View.registerHelper('attribute-error', function(forInputId, options) {
  var tag = options.hash.tag || options.hash.tagName || 'span';
  delete options.hash.tag;
  delete options.hash.tagName;
  options.hash['class'] = options.hash['class'] || 'help-inline';
  options.hash[inputErrorAttributeName] = forInputId;
  return new Handlebars.SafeString(View.tag(options.hash));
});

Thorax.View.registerHelper('input', function(options) {
  var tag = 'input',
      content = null,
      output = '';
  options.hash.id = options.hash.id
    ? Thorax.View.expandToken(options.hash.id, this)
    : (options.hash.name || _.uniqueId('input')) + '-' + this.cid;
  options.hash.placeholder = options.hash.placeholder || options.hash.label;
  if (options.hash.label) {
    output += Thorax.View.tag({
      tag: 'label',
      'for': options.hash.id,
      'class': options.hash['label-class'] || 'control-label'
    });
    delete options.hash['label-class'];
    delete options.hash.label;
  }
  if (options.fn) {
    output += options.fn(this);
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
          selected: false
        }
      }, this);
    }
    content = _.map(function(option) {
      var tagOptions = {
        tag: 'option',
        value: options.value
      };
      if (option.selected) {
        tagOptions.selected = selected;
      }
      return Thorax.View.tag(tagOptions, option.label);
    }).join('');
    delete options.hash.type;
    delete options.hash.options;
  }
  output += Thorax.View.tag(options.hash, content);
  return new Handlebars.SafeString(output);
});
//
//Thorax.View.registerHelper('label', function() {
//
//});
//
//Thorax.View.registerHelper('control-group', function() {
//
//});

function attributeError() {

}

//  options.hash.type = options.hash.type || 'text';
//  options.hash.id = options.hash.id ? expandToken(options.hash.id, scope) : _.uniqueId('txt');

//Handlebars.escapeExpression
//Thorax.View.reigsterHelper('control-group', function(options) {
//  var id = 'input-' + this.cid,
//      label = options.hash.label,
//      
//
//
//});

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
/*
function resetErrorState() {
  this.$('[' + errorAttributeName ']').hide();
  this.$('[' + inputErrorAttributeName + ']').html().hide();
  this.$('.control-group.' + errorClassName).removeClass(errorClassName);
}

Thorax.View.registerEvents({
  rendered: resetErrorState,
  serialize: resetErrorState,
  error: function(errors) {
    this.$('[' + errorAttributeName ']').show();
    errors.forEach(function(error) {
      this.$('[' + errorAttributeName '="' + error.id + '"]']).html(error.message).show();
      error.element.closest('.control-group').addClass(errorClassName);
    }, this);
  }
});
*/
