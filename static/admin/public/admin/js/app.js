// Generated by CoffeeScript 1.3.3
(function() {
  var Application, CreateFileModal, CreateModuleModal, EditRoutesModal, InspectorModal, LumbarConfig, MainView, Module, ThoraxConfig, editOrCreate, generator, inspectorIsVisible, lumbarConfig, mainView, openFile, prefix, saveFile, savedEditor, socket, thoraxConfig;

  prefix = '/admin';

  savedEditor = typeof localStorage !== "undefined" && localStorage !== null ? localStorage.getItem('thorax-admin-editor') : void 0;

  window.Application = Application = new Thorax.Application({
    editor: savedEditor || 'browser'
  });

  socket = io.connect(window.location.protocol + '//' + window.location.host);

  socket.on('reload', function(data) {
    return Application.trigger('reload');
  });

  ThoraxConfig = Application.Model.extend({
    typeFromPath: function(path) {
      var type;
      type = '';
      _.each(this.attributes.paths, function(value, key) {
        if (path.substr(0, value.length) === value) {
          return type = key;
        }
      });
      return type;
    }
  });

  thoraxConfig = new ThoraxConfig({
    modifyLumbarJSON: true,
    editors: {
      "Browser": "browser",
      "Sublime Text": "subl",
      "TextMate": "mate"
    },
    paths: {
      lib: "js/lib",
      views: "js/views",
      collections: "js/collections",
      models: "js/models",
      routers: "js/routers",
      styles: "styles",
      templates: "templates"
    }
  });

  Application.View.registerHelper('relative-path', function(moduleName, type, path) {
    var relativePath;
    relativePath = path.substring(thoraxConfig.attributes.paths[type].length + 1);
    if (relativePath.substr(0, moduleName.length + 1) === moduleName + '/') {
      return relativePath.substring(moduleName.length + 1);
    } else {
      return relativePath;
    }
  });

  LumbarConfig = Application.Model.extend({
    urlRoot: prefix + '/lumbar.json',
    protectedModuleNames: ['base'],
    parse: function(attributes) {
      var _this = this;
      this._templates = attributes.templates;
      return {
        modules: new Application.Collection(_.collect(attributes.modules, function(module, name) {
          return new Module({
            name: name,
            raw: module
          });
        })),
        raw: attributes
      };
    },
    templatesCollectionFromViewPath: function(path) {
      return new Application.Collection(_.collect(this._templates[path] || [], function(templatePath) {
        return {
          path: templatePath
        };
      }));
    },
    getModuleByName: function(moduleName) {
      return this.attributes.modules.find(function(module) {
        return module.attributes.name === moduleName;
      });
    },
    setRoutesForModule: function(moduleName, routes) {
      var foundModule, routesCollection;
      foundModule = this.getModuleByName(moduleName);
      routesCollection = foundModule.attributes.routes;
      routesCollection.reset(foundModule.routesModelsFromRawRoutes(routes));
      return this.attributes.raw.modules[moduleName].routes = routes;
    },
    addViewToModule: function(moduleName, viewName) {
      var foundModule, model;
      foundModule = this.getModuleByName(moduleName);
      model = new Application.Model({
        moduleName: moduleName,
        templates: lumbarConfig.templatesCollectionFromViewPath(viewName),
        raw: {
          src: viewName
        }
      });
      foundModule.attributes.views.add(model);
      return this.attributes.raw.modules[moduleName].scripts.push({
        src: viewName
      });
    },
    addModelToModule: function(moduleName, modelName) {
      var foundModule;
      foundModule = this.getModuleByName(moduleName);
      foundModule.attributes.models.add(new Application.Model({
        raw: {
          src: modelName
        }
      }));
      return this.attributes.raw.modules[moduleName].scripts.push({
        src: modelName
      });
    },
    addCollectionToModule: function(moduleName, collectionName) {
      var foundModule;
      foundModule = this.getModuleByName(moduleName);
      foundModule.attributes.collections.add(new Application.Model({
        raw: {
          src: collectionName
        }
      }));
      return this.attributes.raw.modules[moduleName].scripts.push({
        src: collectionName
      });
    },
    addLibraryToModule: function(moduleName, libraryName) {
      var foundModule;
      foundModule = this.getModuleByName(moduleName);
      foundModule.attributes.lib.add(new Application.Model({
        raw: {
          src: libraryName
        }
      }));
      return this.attributes.raw.modules[moduleName].scripts.push({
        src: libraryName
      });
    },
    addTemplate: function(view, templates) {
      this.attributes.raw.templates[view] = this.attributes.raw.templates[view] || {};
      return this.attributes.raw.templates[view] = templates;
    },
    save: function() {
      return $.ajax({
        type: 'POST',
        url: this.urlRoot,
        data: {
          payload: JSON.stringify(this.attributes.raw)
        },
        dataType: 'text'
      });
    }
  });

  lumbarConfig = new LumbarConfig;

  Module = Application.Model.extend({
    initialize: function(attributes) {
      var _ref, _ref1, _ref2,
        _this = this;
      if (this.attributes.raw.routes) {
        this.attributes.routes = new Application.Collection(this.routesModelsFromRawRoutes(this.attributes.raw.routes));
      } else {
        this.attributes.routes = new Application.Collection;
      }
      this.attributes.views = new Application.Collection;
      this.attributes.collections = new Application.Collection;
      this.attributes.models = new Application.Collection;
      this.attributes.lib = new Application.Collection;
      this.attributes.styles = new Application.Collection;
      this.attributes.routers = new Application.Collection;
      if (this.attributes.raw.styles) {
        this.attributes.styles = new Application.Collection(_.collect(this.attributes.raw.styles, function(style) {
          if (typeof style === 'string') {
            return {
              raw: {
                src: style
              }
            };
          } else {
            return {
              raw: style
            };
          }
        }));
      } else {
        this.attributes.styles = new Application.Collection;
      }
      return (_ref = this.attributes) != null ? (_ref1 = _ref.raw) != null ? (_ref2 = _ref1.scripts) != null ? _ref2.forEach(function(script) {
        var item, model, type;
        item = typeof script === 'string' ? {
          src: script
        } : script;
        if (item.src) {
          type = thoraxConfig.typeFromPath(item.src);
          if (type) {
            model = new Application.Model({
              raw: item
            });
            if (type === 'views') {
              model.attributes.moduleName = _this.attributes.name;
              model.attributes.templates = lumbarConfig.templatesCollectionFromViewPath(model.attributes.raw.src);
            }
            return _this.attributes[type].add(model);
          }
        }
      }) : void 0 : void 0 : void 0;
    },
    routesModelsFromRawRoutes: function(rawRoutes) {
      return _.collect(rawRoutes, function(method, route) {
        return new Application.Model({
          method: method,
          route: route
        });
      });
    }
  });

  generator = new Application.View({
    writeFile: function(path, content) {
      return $.post(prefix + '/file?path=' + path, {
        content: content
      });
    },
    createFile: function(options) {
      var filename, output, templateFileName;
      filename = thoraxConfig.attributes.paths[options.type + 's'] + '/' + options.name + '.js';
      output = this.templates[options.type](options);
      this.writeFile(filename, output);
      if (options.type === 'view') {
        if (options['create-template']) {
          templateFileName = thoraxConfig.attributes.paths.templates + '/' + options.name + '.handlebars';
          this.writeFile(templateFileName, options.name);
          lumbarConfig.addTemplate(filename, [templateFileName]);
        }
        lumbarConfig.addViewToModule(options.module, filename);
      } else if (options.type === 'model') {
        lumbarConfig.addModelToModule(options.module, filename);
      } else if (options.type === 'collection') {
        lumbarConfig.addCollectionToModule(options.module, filename);
      } else if (options.type === 'lib') {
        lumbarConfig.addLibaryToModule(options.module, filename);
      }
      return lumbarConfig.save();
    },
    createModule: function(moduleName, routes, viewsToCreate) {
      var module, routerOutput, routerPath, styleSheetPath,
        _this = this;
      module = new Module({
        name: moduleName,
        raw: {}
      });
      lumbarConfig.attributes.modules.add(module);
      routerOutput = this.templates.router({
        name: moduleName,
        methods: this.generateRouterMethods(moduleName, routes, viewsToCreate)
      });
      routerPath = thoraxConfig.attributes.paths.routers + '/' + moduleName + '.js';
      this.writeFile(routerPath, routerOutput);
      styleSheetPath = thoraxConfig.attributes.paths.styles + '/' + moduleName + '.styl';
      this.writeFile(styleSheetPath, '');
      module.attributes.styles.add(new Application.Model({
        raw: {
          src: styleSheetPath
        }
      }));
      lumbarConfig.attributes.raw.modules[moduleName] = {
        scripts: [
          {
            src: routerPath
          }
        ],
        styles: [
          {
            src: styleSheetPath
          }
        ]
      };
      lumbarConfig.setRoutesForModule(moduleName, routes);
      viewsToCreate.forEach(function(viewToCreate) {
        return _this.createFile({
          type: 'view',
          module: moduleName,
          name: moduleName + '/' + viewToCreate,
          'create-template': 'on'
        });
      });
      return lumbarConfig.save();
    },
    generateRouterMethods: function(moduleName, routes, viewsToCreate) {
      var methods;
      methods = _.map(routes, function(method, path) {
        var output, signature, _ref;
        signature = (_ref = path.match(/\:[\w]+/g)) != null ? _ref.map(function(item) {
          return item.replace(/\:/, '');
        }).join(', ').replace(/\-/g, '_') : void 0;
        method = method.match(/\-/) ? '"' + method + '"' : method;
        output = "  " + method + ": function(" + (signature || '') + ") {\n";
        if (viewsToCreate.indexOf(method !== -1)) {
          output += "    var view = this.view('" + moduleName + "/" + method + "');\n";
          output += "    Application.setView(view);\n";
        }
        output += "  }";
        return output;
      });
      return methods.join(",\n");
    },
    templates: {
      collection: Handlebars.compile("Application.Collection.extend({\n  name: \"{{name}}\"\n});"),
      model: Handlebars.compile("Application.Model.extend({\n  name: \"{{name}}\"\n});"),
      router: Handlebars.compile("Application.Router.extend({\n  name: module.name,\n  routes: module.routes,\n{{{methods}}}\n});"),
      view: Handlebars.compile("Application.View.extend({\n  name: \"{{name}}\",\n  events: {\n    \n  }\n});"),
      lib: Handlebars.compile("")
    }
  });

  Application.View.extend({
    name: 'text-editor',
    config: {
      tabSize: 2,
      fontSize: 14
    },
    modesIndexedByFileExtension: {
      js: "javascript",
      ccs: "css",
      coffee: "coffee",
      json: "json",
      handlebars: "html"
    },
    initialize: function() {
      return this.render();
    },
    edit: function() {
      var session;
      this.editor = ace.edit(this.$('pre')[0]);
      this.editor.setTheme('ace/theme/twilight');
      this.editor.setFontSize(this.config.fontSize);
      this.editor.setPrintMarginColumn(9999);
      this.$('pre').css({
        'font-size': this.config.fontSize + 'px'
      });
      session = this.editor.getSession();
      session.setTabSize(this.config.tabSize);
      session.setUseSoftTabs(true);
      session.setMode("ace/mode/" + (this.modesIndexedByFileExtension[this.file.split(/\./).pop()] || 'text'));
      session.setValue(this.text);
      return this.editor.focus();
    },
    save: function(callback) {
      return saveFile(this.file, this.editor.getSession().getValue(), callback);
    },
    template: "<pre></pre>"
  });

  MainView = Application.View.extend({
    name: 'main',
    events: {
      'change select.editor': function(event) {
        Application.editor = $(event.target).val();
        return typeof localStorage !== "undefined" && localStorage !== null ? localStorage.setItem('thorax-admin-editor', Application.editor) : void 0;
      },
      rendered: function() {
        return this.$('select.editor').val(Application.editor);
      }
    },
    initialize: function() {
      var _this = this;
      this.editors = _.collect(thoraxConfig.attributes.editors, function(value, key) {
        return {
          value: value,
          key: key
        };
      });
      this.frame = new Application.Layout({
        attributes: {
          "class": 'display-frame'
        }
      });
      return Application.bind('reload', function() {
        if (_this.applicationWindow && _this.frame.getView() === _this.applicationWindow) {
          return _this.applicationWindow.reload();
        }
      });
    },
    openApplication: function() {
      this.$('.view-application').show();
      this.$('.view-editor').hide();
      this.applicationWindow = this.view('application-window');
      return this.frame.setView(this.applicationWindow);
    },
    openEditor: function(file) {
      var _this = this;
      this.$('.view-editor').show();
      this.$('.view-application').hide();
      this.$('.view-editor .navbar-text').html(file);
      return $.get("" + prefix + "/file?path=" + file, function(content) {
        _this.editorView = _this.view('text-editor', {
          file: file,
          text: content
        });
        _this.frame.setView(_this.editorView);
        return _this.editorView.edit();
      });
    },
    closeEditor: function(event) {
      event.preventDefault();
      return this.openApplication();
    },
    saveEditor: function(event) {
      var _this = this;
      event.preventDefault();
      return this.editorView.save(function() {
        return _this.openApplication();
      });
    },
    createModule: function(event) {
      return new CreateModuleModal({
        model: new Module({
          raw: {}
        })
      });
    },
    toggleInspector: function(event) {
      var _this = this;
      return _.defer(function() {
        var target, toggled;
        target = $(event.target);
        toggled = target.hasClass('active');
        target.html(toggled ? 'Inspector is On' : 'Inspector is Off');
        return _this.applicationWindow.setInspectorMode(toggled);
      });
    },
    template: "<div class=\"navbar-placeholder\"></div>\n<div class=\"navbar navbar-fixed-top\">\n  <div class=\"navbar-inner\">\n    <div class=\"container\">\n      <div class=\"view-application\">\n        <div class=\"nav pull-right\">\n          <form class=\"form-inline\">\n            <button class=\"btn btn-small\" data-toggle=\"button\" data-call-method=\"toggleInspector\">Inspector is Off</button>\n            <button class=\"btn btn-primary btn-small\" data-call-method=\"createModule\">Create Module</button>\n            <label class=\"navbar-text\">Open files with:</label>\n            <select class=\"editor\">\n              {{#each editors}}\n                <option value=\"{{value}}\">{{key}}</option>\n              {{/each}}\n            </select>\n          </form>\n        </div>\n        <span class=\"brand\">{{raw.application.name}}</span>\n        {{collection modules item-view=\"module-menu\" tag=\"ul\" class=\"nav\"}}\n      </div>\n      <div class=\"view-editor\">\n        <div class=\"nav pull-right\">\n          <button class=\"btn btn-danger\" data-call-method=\"closeEditor\">Close</button>\n          <button class=\"btn btn-primary\" data-call-method=\"saveEditor\">Save</button>\n        </div>\n        <span class=\"brand\">Editing</span>\n        <label class=\"navbar-text\"></label>\n      </div>\n    </div>\n  </div>\n</div>\n{{view frame}}"
  });

  mainView = new MainView;

  editOrCreate = function(event) {
    var createType, editModuleRoutes, moduleName, target;
    event.preventDefault();
    target = $(event.target);
    moduleName = target.parents('[data-module-name]').attr('data-module-name');
    createType = target.attr('data-create-type');
    editModuleRoutes = target.attr('data-edit-module-routes');
    if (createType) {
      return new CreateFileModal({
        module: moduleName,
        type: createType
      });
    } else if (editModuleRoutes) {
      return new EditRoutesModal({
        model: lumbarConfig.attributes.modules.find(function(module) {
          return module.attributes.name === moduleName;
        })
      });
    } else {
      return openFile(target.attr('href'));
    }
  };

  openFile = function(path) {
    if (Application.editor === 'browser') {
      return mainView.openEditor(path);
    } else {
      return $.get("" + prefix + "/open?editor=" + Application.editor + "&path=" + path);
    }
  };

  saveFile = function(path, content, callback) {
    return $.post("" + prefix + "/file?path=" + path, {
      content: content
    }, callback);
  };

  Application.View.extend({
    name: 'module-menu',
    tagName: 'li',
    attributes: function() {
      return {
        "class": 'dropdown',
        'data-module-name': this.model.attributes.name
      };
    },
    events: {
      'click ul.dropdown-menu li a': editOrCreate
    },
    context: function(model) {
      var routerUrl;
      if (model.attributes.name !== 'base') {
        routerUrl = thoraxConfig.attributes.paths.routers + '/' + model.attributes.name + '.js';
      }
      return _.extend({}, model.attributes, {
        routerUrl: routerUrl
      });
    },
    template: "<a href=\"#\" class=\"dropdown-toggle\" data-toggle=\"dropdown\">{{name}} <b class=\"caret\"></b></a>\n<ul class=\"dropdown-menu\">\n  {{#if routerUrl}}\n    <li class=\"nav-header\">Routes</li>\n    <li><a href=\"#\" data-edit-module-routes=\"{{name}}\">Edit Routes</a></li>\n    <li><a href=\"{{routerUrl}}\">Router - {{relative-path name \"routers\" routerUrl}}</a></li>\n  {{/if}}\n  {{^empty views}}\n    <li class=\"divider\"></li>\n    <li class=\"nav-header\">Views</li>\n  {{/empty}}\n  {{collection views item-view=\"file-menu-item\"}}\n  {{^empty models}}\n    <li class=\"divider\"></li>\n    <li class=\"nav-header\">Models</li>\n  {{/empty}}\n  {{#collection models tag=\"li\"}}\n    <a href=\"{{raw.src}}\">{{relative-path name \"models\" raw.src}}</a>\n  {{/collection}}\n  {{^empty collections}}\n    <li class=\"divider\"></li>\n    <li class=\"nav-header\">Collections</li>\n  {{/empty}}\n  {{#collection collections tag=\"li\"}}\n    <a href=\"{{raw.src}}\">{{relative-path name \"collections\" raw.src}}</a>\n  {{/collection}}\n  {{^empty lib}}\n    <li class=\"divider\"></li>\n    <li class=\"nav-header\">Libraries</li>\n  {{/empty}}\n  {{#collection lib tag=\"li\"}}\n    <a href=\"{{raw.src}}\">{{relative-path name \"lib\" raw.src}}</a>\n  {{/collection}}\n  {{^empty styles}}\n    <li class=\"divider\"></li>\n    <li class=\"nav-header\">Styles</li>\n  {{/empty}}\n  {{#collection styles tag=\"li\"}}\n    <a href=\"{{raw.src}}\">{{relative-path name \"lib\" raw.src}}</a>\n  {{/collection}}\n  <li class=\"divider\"></li>\n  <li class=\"nav-header\">Create</li>\n  <li><a href=\"#\" data-create-type=\"view\">View</a></li>\n  <li><a href=\"#\" data-create-type=\"model\">Model</a></li>\n  <li><a href=\"#\" data-create-type=\"collection\">Collection</a></li>\n  <li><a href=\"#\" data-create-type=\"lib\">Library</a></li>\n</ul>"
  });

  Application.View.extend({
    name: 'file-menu-item',
    tagName: 'li',
    events: {
      'click li a': editOrCreate
    },
    template: "<a href=\"{{raw.src}}\">{{relative-path moduleName \"views\" raw.src}}</a>\n{{^empty templates}}\n  {{#collection templates tag=\"ul\"}}\n    <li><a href=\"{{path}}\">{{relative-path ../moduleName \"templates\" path}}</a></li>\n  {{/collection}}\n{{/empty}}"
  });

  inspectorIsVisible = false;

  Application.View.extend({
    tagName: 'iframe',
    attributes: {
      src: '/'
    },
    name: 'application-window',
    template: "",
    getWindow: function() {
      return this.$el[0].contentWindow;
    },
    reload: function() {
      return this.getWindow().location.reload();
    },
    navigate: function(url, options) {
      var currentMode,
        _this = this;
      this.getWindow().Backbone.history.navigate(url, options);
      currentMode = this.inspectorActive;
      return setTimeout(function() {
        _this.setInspectorMode(!currentMode);
        return _this.setInspectorMode(currentMode);
      }, 1500);
    },
    initialize: function() {
      return this.boundViewClick = _.bind(this.viewClick, this);
    },
    viewClick: function(event) {
      console.log('inspectorIsVisible', inspectorIsVisible);
      if (!inspectorIsVisible) {
        return new InspectorModal({
          target: $(event.target)
        });
      }
    },
    setInspectorMode: function(active) {
      var el;
      this.inspectorActive = active;
      el = this.getWindow().$('[data-view-cid]');
      return el[active ? 'on' : 'off']('click', this.boundViewClick);
    }
  });

  InspectorModal = Application.View.extend({
    name: 'inspector-popover',
    events: {
      destroyed: function() {
        return inspectorIsVisible = false;
      }
    },
    hide: function() {
      inspectorIsVisible = false;
      return this.$el.modal('hide');
    },
    show: function() {
      inspectorIsVisible = true;
      this.$el.modal({
        backdrop: false
      });
      return this.$el.modal('show');
    },
    initialize: function() {
      var templatePath, templates,
        _this = this;
      $('body').append(this.$el);
      this.closestView = this.target.closest('[data-view-name]').attr('data-view-name');
      this.closestModel = this.target.closest('[data-model-name]').attr('data-model-name');
      this.closestCollection = this.target.closest('[data-collection-name]').attr('data-collection-name');
      if (this.closestView) {
        templates = lumbarConfig.attributes.raw.templates[thoraxConfig.attributes.paths.views + '/' + this.closestView + '.js'];
        templatePath = thoraxConfig.attributes.paths.templates + '/' + this.closestView + '.handlebars';
        if (templates.indexOf(templatePath !== -1)) {
          this.closestTemplate = this.closestView;
        }
      }
      this.render();
      this.show();
      return this.$el.on('hidden', function() {
        return _this.destroy();
      });
    },
    editTemplate: function() {
      var filePath;
      filePath = thoraxConfig.attributes.paths.templates + '/' + this.closestTemplate + '.handlebars';
      openFile(filePath);
      return this.hide();
    },
    editView: function() {
      var filePath;
      filePath = thoraxConfig.attributes.paths.views + '/' + this.closestView + '.js';
      openFile(filePath);
      return this.hide();
    },
    editModel: function() {
      openFile(thoraxConfig.attributes.paths.models + '/' + this.closestModel + '.js');
      return this.hide();
    },
    editCollection: function() {
      openFile(thoraxConfig.attributes.paths.models + '/' + this.closestCollection + '.js');
      return this.hide();
    },
    template: "<div class=\"modal\">\n  <div class=\"modal-header\">\n    <h3>Inspector</h3>\n  </div>\n  <div class=\"modal-body\">\n    {{#if closestView}}\n      <p><strong>View:</strong> {{closestView}} <button class=\"btn\" data-call-method=\"editView\">Edit</button></p>\n    {{/if}}\n    {{#if closestTemplate}}\n      <p><strong>Template:</strong> {{closestTemplate}} <button class=\"btn\" data-call-method=\"editTemplate\">Edit</button></p>\n    {{/if}}\n    {{#if closestModel}}\n      <p><strong>Model:</strong> {{closestModel}} <button class=\"btn\" data-call-method=\"editModel\">Edit</button></p>\n    {{/if}}\n    {{#if closestCollection}}\n      <p><strong>Collection:</strong> {{closestCollection}} <button class=\"btn\" data-call-method=\"editCollection\">Edit</button></p>\n    {{/if}}\n  </div>\n  <div class=\"modal-footer\">\n    <input type=\"submit\" class=\"btn btn-primary\" data-dismiss=\"modal\" value=\"Close\">\n  </div>\n</div>"
  });

  EditRoutesModal = Application.View.extend({
    name: 'edit-routes-modal',
    events: {
      'submit form': function(event) {
        var _this = this;
        return this.serialize(event, function(attributes, release) {
          var routes;
          if (attributes.route) {
            routes = {};
            _.each(attributes.route, function(route) {
              return routes[route.path] = route.method;
            });
            lumbarConfig.setRoutesForModule(_this.model.attributes.name, routes);
            lumbarConfig.save();
          }
          _this.hide();
          return release();
        });
      }
    },
    hide: function() {
      return this.$el.modal('hide');
    },
    show: function() {
      return this.$el.modal('show');
    },
    initialize: function() {
      var _this = this;
      $('body').append(this.$el);
      this.render();
      this.show();
      return this.$el.on('hidden', function() {
        return _this.destroy();
      });
    },
    createRoute: function(event) {
      this.model.attributes.routes.add(new Application.Model({
        route: '',
        method: ''
      }));
      return this.$('tbody > tr:last-child td:first-child input')[0].focus();
    },
    removeRoute: function(event) {
      var collection, model;
      model = $(event.target).model();
      collection = $(event.target).collection();
      return collection.remove(model);
    },
    visitRoute: function(event) {
      var route, _ref;
      route = $(event.target).model().attributes.route;
      if ((_ref = mainView.applicationWindow) != null) {
        _ref.navigate(route, {
          trigger: true
        });
      }
      return this.hide();
    },
    template: "<div class=\"modal\">\n  <form class=\"form-vertical\">\n    <div class=\"modal-header\">\n      <h3>Edit \"{{name}}\" Routes</h3>\n    </div>\n    <div class=\"modal-body\">\n      <table class=\"table table-bordered table-striped table-condensed\">\n        <thead>\n          <tr>\n            <th>Route</th>\n            <th>Method</th>\n            <th></th>\n            <th></th>\n          </tr>\n        </thead>\n        {{#collection routes tag=\"tbody\"}}\n          <tr>\n            <td><input type=\"text\" id=\"route-{{cid}}\" name=\"route[{{cid}}][path]\" value=\"{{route}}\"></td>\n            <td><input type=\"text\" id=\"method-{{cid}}\" name=\"route[{{cid}}][method]\" value=\"{{method}}\"></td>\n            <td><button class=\"btn btn-mini\" data-call-method=\"visitRoute\">Visit</button></td>\n            <td><button class=\"btn btn-danger btn-mini\" data-call-method=\"removeRoute\">Remove</button></td>\n          </tr>\n        {{else}}\n          <tr>\n            <td colspan=\"4\">No Routes</td>\n          </tr>\n        {{/collection}}\n      </table>\n      <button class=\"btn btn-success\" data-call-method=\"createRoute\">Create Route</button>\n    </div>\n    <div class=\"modal-footer\">\n      <input type=\"button\" class=\"btn\" data-dismiss=\"modal\" value=\"Close\">\n      <input type=\"submit\" class=\"btn btn-primary\" value=\"Save Changes\">\n    </div>\n  </form>\n</div>"
  });

  CreateModuleModal = Application.View.extend({
    name: 'create-module-modal',
    events: {
      'submit form': function(event) {
        var _this = this;
        return this.serialize(event, function(attributes, release) {
          var routes, viewsToCreate;
          if (attributes.route) {
            viewsToCreate = [];
            routes = {};
            _.each(attributes.route, function(route) {
              routes[route.path] = route.method;
              if (route['create-view'] && route['create-view'] === 'on') {
                return viewsToCreate.push(route.method);
              }
            });
          }
          generator.createModule(attributes.name, routes, viewsToCreate);
          _this.hide();
          return release();
        });
      }
    },
    hide: function() {
      return this.$el.modal('hide');
    },
    show: function() {
      return this.$el.modal('show');
    },
    initialize: function() {
      var _this = this;
      $('body').append(this.$el);
      this.render();
      this.show();
      return this.$el.on('hidden', function() {
        return _this.destroy();
      });
    },
    createRoute: function(event) {
      this.model.attributes.routes.add(new Application.Model({
        route: '',
        method: ''
      }));
      return this.$('tbody > tr:last-child td:first-child input')[0].focus();
    },
    removeRoute: function(event) {
      var collection, model;
      model = $(event.target).model();
      collection = $(event.target).collection();
      return collection.remove(model);
    },
    template: "<div class=\"modal\">\n  <form class=\"form-vertical\">\n    <div class=\"modal-header\">\n      <h3>Create Module</h3>\n    </div>\n    <div class=\"modal-body\">\n      <label for=\"name-{{cid}}\"><strong>Module Name</strong></label>\n      <input type=\"text\" id=\"name-{{cid}}\" name=\"name\">\n      <br/><br/>\n      <table class=\"table table-bordered table-striped table-condensed\">\n        <thead>\n          <tr>\n            <th>Route</th>\n            <th>Method</th>\n            <th>Create View?</th>\n            <th></th>\n          </tr>\n        </thead>\n        {{#collection routes tag=\"tbody\"}}\n          <tr>\n            <td><input type=\"text\" id=\"route-{{cid}}\" name=\"route[{{cid}}][path]\" value=\"{{route}}\"></td>\n            <td><input type=\"text\" id=\"method-{{cid}}\" name=\"route[{{cid}}][method]\" value=\"{{method}}\"></td>\n            <td><input type=\"checkbox\" id=\"create-view-{{cid}}\" name=\"route[{{cid}}][create-view]\" checked=\"checked\"></td>\n            <td><button class=\"btn btn-danger btn-mini\" data-call-method=\"removeRoute\">Remove</button></td>\n          </tr>\n        {{else}}\n          <tr>\n            <td colspan=\"4\">No Routes</td>\n          </tr>\n        {{/collection}}\n      </table>\n      <button class=\"btn btn-success\" data-call-method=\"createRoute\">Create Route</button>\n    </div>\n    <div class=\"modal-footer\">\n      <input type=\"button\" class=\"btn\" data-dismiss=\"modal\" value=\"Close\">\n      <input type=\"submit\" class=\"btn btn-primary\" value=\"Create Module\">\n    </div>\n  </form>\n</div>"
  });

  CreateFileModal = Application.View.extend({
    events: function() {
      return {
        'submit form': function(event) {
          var _this = this;
          return this.serialize(event, function(attributes, release) {
            var name;
            name = attributes.name.replace(/\/$/, '');
            if (name !== '') {
              generator.createFile({
                module: _this.module,
                type: _this.type,
                name: name,
                'create-template': attributes['create-template'] && attributes['create-template'] === 'on'
              });
            }
            release();
            return _this.hide();
          });
        },
        'keyup input[name="name"]': function(event) {
          var newVal, oldVal, target;
          target = $(event.target);
          oldVal = target.val();
          newVal = oldVal.replace(/([^a-z\/\-]+|^\/)/g, '').replace(/\/{2,}/g, '/');
          if (oldVal !== newVal) {
            return target.val(newVal);
          }
        }
      };
    },
    initialize: function() {
      var _this = this;
      this.isView = this.type === 'view';
      this.name = this.type === 'lib' ? 'Library' : this.type.charAt(0).toUpperCase() + this.type.slice(1);
      $('body').append(this.$el);
      this.render();
      this.show();
      this.$el.on('hidden', function() {
        return _this.destroy();
      });
      return this.$('input[type="text"]').val(this.module + '/').focus();
    },
    hide: function() {
      return this.$el.modal('hide');
    },
    show: function() {
      return this.$el.modal('show');
    },
    template: "<div class=\"modal\">\n  <form class=\"form-horizontal\">\n    <div class=\"modal-header\">\n      <h3>Create new {{name}}</h3>\n    </div>\n    <div class=\"modal-body\">\n      <div class=\"control-group\">\n        <label class=\"control-label\" for=\"name-{{cid}}\"><b>Name</b></label>\n        <div class=\"controls\">\n          <input type=\"text\" name=\"name\" id=\"name-{{cid}}\">\n        </div>\n      </div>\n      {{#if isView}}\n        <div class=\"control-group\">\n          <label class=\"control-label\" for=\"create-template-{{cid}}\">Create template?</label>\n          <div class=\"controls\">\n            <input class=\"checkbox\" checked=\"checked\" type=\"checkbox\" name=\"create-template\" id=\"create-template-{{cid}}\">\n          </div>\n        </div>\n      {{/if}}\n    </div>\n    <div class=\"modal-footer\">\n      <button class=\"btn\" data-dismiss=\"modal\">Cancel</button>\n      <input type=\"submit\" class=\"btn btn-primary\" value=\"Create\">\n    </div>\n  </form>\n</div>"
  });

  $(function() {
    return lumbarConfig.fetch({
      success: function() {
        mainView.setModel(lumbarConfig);
        Application.setView(mainView);
        $('body').append(Application.el);
        mainView.openApplication();
        return Application.start();
      }
    });
  });

}).call(this);
