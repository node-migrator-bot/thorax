# Todo:
# - create the editor with the editor
# - module modal
# - edit routes modal
# - find relevant files mode, should appear as tooltip
#   look at data-view-name, data-model-name data-collection-name
# - break editor and creator into lumbar files
# - fix heroku deploy problem
# 
# - object inspector
#   be able to click on anything and have a modal appear
#   showing a link to edit the file
#   and a form to edit the bound models or collections
#   form will attempt to call @save() on the live data model  

prefix = '/admin'
savedEditor = localStorage?.getItem 'thorax-admin-editor'
window.Application = Application = new Thorax.Application editor: savedEditor or 'browser'
socket = io.connect window.location.protocol + '//' + window.location.host
socket.on 'reload', (data) ->
  Application.trigger 'reload'

ThoraxConfig = Application.Model.extend
  typeFromPath: (path) ->
    type = ''
    _.each @attributes.paths, (value, key) ->
      if path.substr(0, value.length) is value
        type = key
    return type

thoraxConfig = new ThoraxConfig
  modifyLumbarJSON: true
  editors:
    "Browser": "browser"
    "Sublime Text": "subl"
    "TextMate": "mate"
  paths:
    lib: "js/lib"
    views: "js/views"
    collections: "js/collections"
    models: "js/models"
    routers: "js/routers"
    styles: "styles"
    templates: "templates"

Application.View.registerHelper 'relative-path', (moduleName, type, path) ->
  relativePath = path.substring thoraxConfig.attributes.paths[type].length + 1
  if relativePath.substr(0, moduleName.length + 1) is moduleName + '/'
    relativePath.substring moduleName.length + 1
  else
    relativePath

LumbarConfig = Application.Model.extend
  urlRoot: prefix + '/lumbar.json'
  protectedModuleNames: ['base']
  parse: (attributes) ->
    #race condition on templates, templatesCollectionFromViewPath needs them before parse is done
    @_templates = attributes.templates
    {
      modules: new Application.Collection _.collect attributes.modules, (module, name) =>
        new Module name: name, raw: module
      raw: attributes
    }
  templatesCollectionFromViewPath: (path) ->
    new Application.Collection _.collect @_templates[path] || [], (templatePath) ->
      path: templatePath

lumbarConfig = new LumbarConfig

Module = Application.Model.extend
  initialize: (attributes) ->
    if @attributes.raw.routes
      @attributes.routes = new Application.Collection _.collect @attributes.raw.routes, (method, route) ->
        method: method
        route: route
    @attributes.views = new Application.Collection
    @attributes.collections = new Application.Collection
    @attributes.models = new Application.Collection
    @attributes.lib = new Application.Collection
    @attributes.styles = new Application.Collection
    @attributes.routers = new Application.Collection

    if @attributes.raw.styles
      @attributes.styles = new Application.Collection _.collect @attributes.raw.styles, (style) ->
        if typeof style is 'string' then {raw: {src: style}} else {raw: style}

    @attributes.raw.scripts.forEach (script) =>
      item = if typeof script is 'string' then {src: script} else script
      if item.src
        type = thoraxConfig.typeFromPath item.src
        if type
          model = new Application.Model raw: item
          if type is 'views'
            model.attributes.moduleName = @attributes.name
            model.attributes.templates = lumbarConfig.templatesCollectionFromViewPath model.attributes.raw.src
          @attributes[type].add model

generator = new Application.View
  generate: (type, context) ->
    @template @templates[type], context
  createFile: (options) ->
    console.log 'createfile', options
  templates:
    collection: Handlebars.compile """
      Application.Collection.extend({
        name: "{{name}}"
      });
    """
    model: Handlebars.compile """
      Application.Model.extend({
        name: "{{name}}"
      });
    """
    router: Handlebars.compile """
      Application.Router.extend({
        name: module.name,
        routes: module.routes,
        {{methods}}
      });
    """
    view: Handlebars.compile """
      Application.View.extend({
        name: "{{name}}",
        events: {
          
        }
      });
    """
    lib: Handlebars.compile ""

Application.View.extend
  name: 'text-editor'
  config:
    tabSize: 2
    fontSize: 14
  modesIndexedByFileExtension:
    js: "javascript"
    ccs: "css"
    coffee: "coffee"
    json: "json"
    handlebars: "html"
  initialize: ->
    @render()
  edit: ->
    @editor = ace.edit @$('pre')[0]
    @editor.setTheme 'ace/theme/twilight'
    @editor.setFontSize @config.fontSize
    @editor.setPrintMarginColumn 9999
    @$('pre').css 'font-size': @config.fontSize + 'px'
    session = @editor.getSession()
    session.setTabSize @config.tabSize
    session.setUseSoftTabs true
    session.setMode "ace/mode/" + (@modesIndexedByFileExtension[@file.split(/\./).pop()] or 'text')
    session.setValue @text
    @editor.focus()
  save: (callback) ->
    saveFile @file, @editor.getSession().getValue(), callback
  template: """
    <pre></pre>
  """

MainView = Application.View.extend
  name: 'main'
  events:
    'change select.editor': (event) ->
      Application.editor = $(event.target).val()
      localStorage?.setItem 'thorax-admin-editor', Application.editor 
    rendered: ->
      @$('select.editor').val Application.editor
  initialize: ->
    @editors = _.collect thoraxConfig.attributes.editors, (value, key) ->
      value: value
      key: key
    @frame = new Application.Layout attributes: class: 'display-frame'
    Application.bind 'reload', =>
      if @applicationWindow and @frame.view is @applicationWindow
        @applicationWindow.reload()
  openApplication: ->
    @$('.view-application').show()
    @$('.view-editor').hide()
    @applicationWindow = @view 'application-window'
    @frame.setView @applicationWindow
  openEditor: (file) ->
    @$('.view-editor').show()
    @$('.view-application').hide()
    @$('.view-editor .navbar-text').html file
    $.get "#{prefix}/file?path=#{file}", (content) =>
      @editorView = @view 'text-editor', file: file, text: content
      @frame.setView @editorView
      @editorView.edit()
  closeEditor: (event) ->
    event.preventDefault()
    if confirm 'Close without saving?'
      @openApplication()
  saveEditor: (event) ->
    event.preventDefault()
    @editorView.save =>
      @openApplication()
  createModule: (event) ->
    console.log '!'
  toggleInspector: (event) ->
    _.defer =>
      target = $(event.target)
      toggled = target.hasClass 'active'
      target.html if toggled then 'Inspector On' else 'Inspector Off'
      @applicationWindow.setInspectorMode toggled
  template: """
    <div class="navbar-placeholder"></div>
    <div class="navbar navbar-fixed-top">
      <div class="navbar-inner">
        <div class="container">
          <div class="view-application">
            <div class="nav pull-right">
              <form class="form-inline">
                <button class="btn btn-small" data-toggle="button" data-call-method="toggleInspector">Inspector Off</button>
                <button class="btn btn-primary btn-small" data-call-method="createModule">Create Module</button>
                <label class="navbar-text">Open files with:</label>
                <select class="editor">
                  {{#each editors}}
                    <option value="{{value}}">{{key}}</option>
                  {{/each}}
                </select>
              </form>
            </div>
            <span class="brand">{{raw.application.name}}</span>
            {{collection modules item-view="module-menu" tag="ul" class="nav"}}
          </div>
          <div class="view-editor">
            <div class="nav pull-right">
              <button class="btn btn-danger" data-call-method="closeEditor">Close</button>
              <button class="btn btn-primary" data-call-method="saveEditor">Save</button>
            </div>
            <span class="brand">Editing</span>
            <label class="navbar-text"></label>
          </div>
        </div>
      </div>
    </div>
    {{view frame}}
  """
mainView = new MainView

editOrCreate = (event) ->
  event.preventDefault()
  target = $(event.target)
  moduleName = target.parents('[data-module-name]').attr 'data-module-name'
  createType = target.attr 'data-create-type'
  editModuleRoutes = target.attr 'data-edit-module-routes'
  if createType
    new CreateFileModal module: moduleName, type: createType
  else if editModuleRoutes
    new EditRoutesModal model: lumbarConfig.attributes.modules.find (module) -> module.attributes.name is moduleName
  else
    openFile target.attr('href')

openFile = (path) ->
  if Application.editor is 'browser'
    mainView.openEditor path
  else
    $.get "#{prefix}/open?editor=#{Application.editor}&path=#{path}"

saveFile = (path, content, callback) ->
  $.post "#{prefix}/file?path=#{path}", content: content, callback

Application.View.extend
  name: 'module-menu'
  tagName: 'li'
  attributes: ->
    class: 'dropdown'
    'data-module-name': @model.attributes.name
  events:
    'click ul.dropdown-menu li a': editOrCreate
  context: (model) ->
    if model.attributes.name isnt 'base'
      routerUrl = thoraxConfig.attributes.paths.routers + '/' + model.attributes.name + '.js'
    _.extend {}, model.attributes,
      routerUrl: routerUrl
  template: """
    <a href="#" class="dropdown-toggle" data-toggle="dropdown">{{name}} <b class="caret"></b></a>
    <ul class="dropdown-menu">
      {{#if routerUrl}}
        <li class="nav-header">Routes</li>
        <li><a href="#" data-edit-module-routes="{{name}}">Edit Routes</a></li>
        <li><a href="{{routerUrl}}">Router - {{relative-path name "routers" routerUrl}}</a></li>
      {{/if}}
      {{^empty views}}
        <li class="divider"></li>
        <li class="nav-header">Views</li>
      {{/empty}}
      {{collection views item-view="file-menu-item"}}
      {{^empty models}}
        <li class="divider"></li>
        <li class="nav-header">Models</li>
      {{/empty}}
      {{#collection models tag="li"}}
        <a href="{{raw.src}}">{{relative-path name "models" raw.src}}</a>
      {{/collection}}
      {{^empty collections}}
        <li class="divider"></li>
        <li class="nav-header">Collections</li>
      {{/empty}}
      {{#collection collections tag="li"}}
        <a href="{{raw.src}}">{{relative-path name "collections" raw.src}}</a>
      {{/collection}}
      {{^empty lib}}
        <li class="divider"></li>
        <li class="nav-header">Libraries</li>
      {{/empty}}
      {{#collection lib tag="li"}}
        <a href="{{raw.src}}">{{relative-path name "lib" raw.src}}</a>
      {{/collection}}
      <li class="divider"></li>
      <li class="nav-header">Create</li>
      <li><a href="#" data-create-type="view">View</a></li>
      <li><a href="#" data-create-type="model">Model</a></li>
      <li><a href="#" data-create-type="collection">Collection</a></li>
      <li><a href="#" data-create-type="lib">Library</a></li>
    </ul>
  """

Application.View.extend
  name: 'file-menu-item'
  tagName: 'li'
  events:
    'click li a': editOrCreate
  template: """
    <a href="{{raw.src}}">{{relative-path moduleName "views" raw.src}}</a>
    {{^empty templates}}
      {{#collection templates tag="ul"}}
        <li><a href="{{path}}">{{relative-path ../moduleName "templates" path}}</a></li>
      {{/collection}}
    {{/empty}}
  """

Application.View.extend
  tagName: 'iframe'
  attributes:
    src: '/'
  name: 'application-window'
  template: ""
  getWindow: ->
    @$el[0].contentWindow
  reload: ->
    @getWindow().location.reload()
  navigate: (url, options) ->
    @getWindow().Backbone.history.navigate url, options
  initialize: ->
    @boundViewClicked = _.bind @viewClicked, @
  viewClicked: (event) ->
    console.log '!'
  setInspectorMode: (active) ->
    @getWindow().$('[data-view-cid]')[if active then 'on' else 'off'] 'click', @boundViewClicked

EditRoutesModal = Application.View.extend
  events:
    'submit form': (event) ->
      @serialize event, (attributes, release) =>
        console.log attributes
        release()
  hide: ->
    @$el.modal 'hide'
  show: ->
    @$el.modal 'show'
  initialize: ->
    $('body').append @$el
    @render()
    @show()
    @$el.on 'hidden', => @destroy()
  createRoute: (event) ->
    @model.attributes.routes.add new Application.Model route: '', method: ''
    @$('tbody > tr:last-child td:first-child input')[0].focus()
  removeRoute: (event) ->
    $(event.target).parents('[data-model-cid]').attr('data-model-cid')
  template: """
    <div class="modal">
      <form class="form-vertical">
        <div class="modal-header">
          <h3>Edit "{{name}}" Routes</h3>
        </div>
        <div class="modal-body">
          <table class="table table-bordered table-striped table-condensed">
            <thead>
              <tr>
                <th>Route</th>
                <th>Method</th>
                <th></th>
              </tr>
            </thead>
            {{#collection routes tag="tbody"}}
              <tr>
                <td><input type="text" id="route-{{cid}}" name="route-{{cid}}" value="{{route}}"></td>
                <td><input type="text" id="method-{{cid}}" name="method-{{cid}}" value="{{method}}"></td>
                <td><button class="btn btn-danger btn-mini" data-call-method="removeRoute">Remove</button></td>
              </tr>
            {{/collection}}
          </table>
          <button class="btn btn-success" data-call-method="createRoute">Create Route</button>
        </div>
        <div class="modal-footer">
          <input type="submit" class="btn btn-primary" data-dismiss="modal">
        </div>
      </form>
    </div>
  """



CreateFileModal = Application.View.extend
  events: ->
    'submit form': (event) ->
      @serialize event, (attributes, release) =>
        name = attributes.name.replace(/\/$/, '')
        if name isnt ''
          generator.createFile
            module: @module
            type: @type
            name: name
            'create-template': attributes['create-template'] and attributes['create-template'] is 'on'
        release()
        @hide()
    'keyup input[name="name"]': (event) ->
      target = $(event.target)
      oldVal = target.val()
      newVal = oldVal.replace(/([^a-z\/\-]+|^\/)/g, '').replace(/\/{2,}/g, '/')
      if oldVal isnt newVal
        target.val newVal
  initialize: ->
    @isView = @type is 'view'
    @name = if @type is 'lib' then 'Library' else @type.charAt(0).toUpperCase() + @type.slice(1);
    $('body').append @$el
    @render()
    @show()
    @$el.on 'hidden', => @destroy()
    @$('input[type="text"]').focus()
  hide: ->
    @$el.modal 'hide'
  show: ->
    @$el.modal 'show'
  template: """
    <div class="modal">
      <form class="form-horizontal">
        <div class="modal-header">
          <h3>Create new {{name}}</h3>
        </div>
        <div class="modal-body">
          <div class="control-group">
            <label class="control-label" for="name-{{cid}}"><b>Name</b></label>
            <div class="controls">
              <input type="text" name="name" id="name-{{cid}}">
            </div>
          </div>
          {{#if isView}}
            <div class="control-group">
              <label class="control-label" for="create-template-{{cid}}">Create template?</label>
              <div class="controls">
                <input class="checkbox" checked="checked" type="checkbox" name="create-template" id="create-template-{{cid}}">
              </div>
            </div>
          {{/if}}
        </div>
        <div class="modal-footer">
          <button class="btn" data-dismiss="modal">Cancel</button>
          <input type="submit" class="btn btn-primary" value="Create">
        </div>
      </form>
    </div>
  """

$ ->
  lumbarConfig.fetch success: ->
    mainView.setModel lumbarConfig
    Application.setView mainView
    $('body').append Application.el
    mainView.openApplication()
