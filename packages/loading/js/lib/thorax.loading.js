(function() {

var loadStart = 'load:start',
    loadEnd = 'load:end';

/**
 * load:start / load:end handler.
 *
 * Generates an load:start event handler that when triggered will
 * then monitor the associated object for a load:end event. If the
 * duration between the start and and the end events exceed
 * `_loadingTimeoutDuration` then the `start` and `end` callbacks
 * will be triggered at the appropriate times to allow the display
 * of a loading UI.
 *
 * Example:
 *    object.bind('load:start', Thorax.loadHandler(
 *      function(message, background, object) {
 *        element.addClass('loading');
 *      },
 *      function(background, object) {
 *        element.removeClass('loading');
 *      }));
 *
 */
Thorax.loadHandler = function(start, end) {
  return function(message, background, object) {
    var self = this;

    function startLoadTimeout() {
      clearTimeout(self._loadStart.timeout);
      self._loadStart.timeout = setTimeout(function() {
          self._loadStart.run = true;
          start.call(self, self._loadStart.message, self._loadStart.background, self._loadStart);
        },
        loadingTimeout*1000);
    }

    if (!self._loadStart) {
      var loadingTimeout = self._loadingTimeoutDuration;
      if (loadingTimeout === void 0) {
        // If we are running on a non-view object pull the default timeout
        loadingTimeout = Thorax.View.prototype._loadingTimeoutDuration;
      }

      self._loadStart = _.extend({
        events: [],
        timeout: 0,
        message: message,
        background: !!background
      }, Backbone.Events);
      startLoadTimeout();
    } else {
      clearTimeout(self._loadStart.endTimeout);

      self._loadStart.message = message;
      if (!background && self._loadStart.background) {
        self._loadStart.background = false;
        startLoadTimeout();
      }
    }

    self._loadStart.events.push(object);
    object.bind(loadEnd, function endCallback() {
      object.unbind(loadEnd, endCallback);

      var loadingEndTimeout = self._loadingTimeoutEndDuration;
      if (loadingEndTimeout === void 0) {
        // If we are running on a non-view object pull the default timeout
        loadingEndTimeout = Thorax.View.prototype._loadingTimeoutEndDuration;
      }

      var events = self._loadStart.events,
          index = events.indexOf(object);
      if (index >= 0) {
        events.splice(index, 1);
      }
      if (!events.length) {
        self._loadStart.endTimeout = setTimeout(function(){
          if (!events.length) {
            var run = self._loadStart.run;

            if (run) {
              // Emit the end behavior, but only if there is a paired start
              end.call(self, self._loadStart.background, self._loadStart);
              self._loadStart.trigger(loadEnd, self._loadStart);
            }

            // If stopping make sure we don't run a start
            clearTimeout(self._loadStart.timeout);
            self._loadStart = undefined;
          }
        }, loadingEndTimeout * 1000);
      }
    });
  };
};

/**
 * Helper method for propagating load:start events to other objects.
 *
 * Forwards load:start events that occur on `source` to `dest`.
 */
Thorax.forwardLoadEvents = function(source, dest, once) {
  function load(message, backgound, object) {
    if (once) {
      source.unbind(loadStart, load);
    }
    dest.trigger(loadStart, message, backgound, object);
  }
  source.bind(loadStart, load);
  return {
    unbind: function() {
      source.unbind(loadStart, load);
    }
  };
};

//
// Data load event generation
//

/**
 * Mixing for generating load:start and load:end events.
 */
Thorax.LoadableMixin = {
  loadStart: function(message, background) {
    this.trigger(loadStart, message, background, this);
  },
  loadEnd: function() {
    this.trigger(loadEnd, this);
  }
};

_.extend(Thorax.View.prototype, Thorax.LoadableMixin);

Thorax.sync = function(method, dataObj, options) {
  var self = this,
      complete = options.complete;

  options.complete = function() {
    self._request = undefined;
    self._aborted = false;

    complete && complete.apply(this, arguments);
  };
  this._request = Backbone.sync.apply(this, arguments);

  // TODO : Reevaluate this event... Seems too indepth to expose as an API
  this.trigger('request', this._request);
  return this._request;
};

function bindToRoute(callback, failback) {
  var fragment = Backbone.history.getFragment(),
      completed;

  function finalizer(isCanceled) {
    var same = fragment === Backbone.history.getFragment();

    if (completed) {
      // Prevent multiple execution, i.e. we were canceled but the success callback still runs
      return;
    }

    if (isCanceled && same) {
      // Ignore the first route event if we are running in newer versions of backbone
      // where the route operation is a postfix operation.
      return;
    }

    completed = true;
    Backbone.history.unbind('route', resetLoader);

    var args = Array.prototype.slice.call(arguments, 1);
    if (!isCanceled && same) {
      callback.apply(this, args);
    } else {
      failback && failback.apply(this, args);
    }
  }

  var resetLoader = _.bind(finalizer, this, true);
  Backbone.history.bind('route', resetLoader);

  return _.bind(finalizer, this, false);
}

function loadData(callback, failback, options) {
  if (this.isPopulated()) {
    return callback(this);
  }

  if (arguments.length === 2 && typeof failback !== 'function' && _.isObject(failback)) {
    options = failback;
    failback = false;
  }

  this.fetch(_.defaults({
    success: bindToRoute(callback, failback && _.bind(failback, this, false)),
    error: failback && _.bind(failback, this, true)
  }, options));
}

function fetchQueue(options, $super) {
  if (options.resetQueue) {
    // WARN: Should ensure that loaders are protected from out of band data
    //    when using this option
    this.fetchQueue = undefined;
  }

  if (!this.fetchQueue) {
    // Kick off the request
    this.fetchQueue = [options];
    options = _.defaults({
      success: flushQueue(this, this.fetchQueue, 'success'),
      error: flushQueue(this, this.fetchQueue, 'error'),
      complete: flushQueue(this, this.fetchQueue, 'complete')
    }, options);
    $super.call(this, options);
  } else {
    // Currently fetching. Queue and process once complete
    this.fetchQueue.push(options);
  }
}

function flushQueue(self, fetchQueue, handler) {
  return function() {
    var args = arguments;

    // Flush the queue. Executes any callback handlers that
    // may have been passed in the fetch options.
    fetchQueue.forEach(function(options) {
      if (options[handler]) {
        options[handler].apply(this, args);
      }
    }, this);

    // Reset the queue if we are still the active request
    if (self.fetchQueue === fetchQueue) {
      self.fetchQueue = undefined;
    }
  }
}

_.each([Thorax.Collection, Thorax.Model], function(DataClass) {
  var $fetch = DataClass.prototype.fetch;

  _.extend(DataClass.prototype, Thorax.LoadableMixin, {
    sync: Thorax.sync,

    fetch: function(options) {
      options = options || {};

      var self = this,
          complete = options.complete;

      options.complete = function() {
        complete && complete.apply(this, arguments);
        self.loadEnd();
      };
      self.loadStart(undefined, options.background);
      return fetchQueue.call(this, options || {}, $fetch);
    },

    load: function(callback, failback, options) {
      if (arguments.length === 2 && typeof failback !== 'function') {
        options = failback;
        failback = false;
      }
      options = options || {};

      if (!options.background && !this.isPopulated()) {
        // Make sure that the global scope sees the proper load events here
        // if we are loading in standalone mode
        Thorax.forwardLoadEvents(this, exports, true);
      }

      var self = this;
      loadData.call(this, callback,
        function(isError) {
          // Route changed, kill it
          if (!isError) {
            if (self._request) {
              self._aborted = true;
              self._request.abort();
            }
          }

          failback && failback.apply && failback.apply(this, arguments);
        },
        options);
    }
  });
});

Thorax.Model.prototype._loadModel = function(model, options) {
  model.load(function(){
    options.success && options.success(model);
  }, options);
};

Thorax.Model.prototype._loadCollection = function(collection, options) {
  collection.load(function(){
    options.success && options.success(collection);
  }, options);
};

Thorax.Router.prototype.bindToRoute = bindToRoute;
Thorax.Router.bindToRoute = bindToRoute;

//
// View load event handling
//
var superSetModelOptions = Thorax.View.prototype.setModelOptions,
    superSetCollectionOptions = Thorax.View.prototype.setCollectionOptions;

_.extend(Thorax.View.prototype, {
  //loading config
  _loadingClassName: 'loading',
  _loadingTimeoutDuration: 0.33,
  _loadingTimeoutEndDuration: 0.10,

  // Propagates loading view parameters to the AJAX layer
  setCollectionOptions: function(collection, options) {
    return superSetCollectionOptions.call(this, collection, _.defaults({
      ignoreErrors: this.ignoreFetchError,
      background: this.nonBlockingLoad
    }, options || {}));
  },
  setModelOptions: function(options) {
    return superSetModelOptions.call(this, _.defaults({
      ignoreErrors: this.ignoreFetchError,
      background: this.nonBlockingLoad
    }, options || {}));
  },

  onLoadStart: function(message, background, object) {
    if (!this.nonBlockingLoad && !background) {
      exports.trigger(loadStart, message, background, object);
    }
    $(this.el).addClass(this._loadingClassName);
  },
  onLoadEnd: function(background, object) {
    $(this.el).removeClass(this._loadingClassName);
  }
});

Thorax.View.registerEvents({
  'load:start': Thorax.loadHandler(
      function(message, background, object) {
        this.onLoadStart(message, background, object);
      },
      function(background, object) {
        this.onLoadEnd(object);
      }),

  collection: {
    'load:start': function(partial, message, background, object) {
      this.trigger(loadStart, message, background, object);
    }
  },
  model: {
    'load:start': function(message, background, object) {
      this.trigger(loadStart, message, background, object);
    }
  }
});

Thorax.View.registerPartialHelper('loading', function(collectionOrModel, partial) {
  if (arguments.length === 1) {
    partial = collectionOrModel;
    collectionOrModel = false;
  }

  function callback(scope) {
    var content;
    if (partial.view.$el.hasClass(partial.view._loadingClassName)) {
      content = options.fn(scope || partial.context());
    } else {
      content = options.inverse(scope || partial.context());
    }
    partial.html(content);
  }

  var target = collectionOrModel || partial.view;

  target.on(loadStart, callback);
  target.on(loadEnd, callback);

  partial.bind('freeze', function() {
    target.off(loadStart, callback);
    target.off(loadEnd, callback);
  });

  callback(this);
});

var oldCollectionHelper = Handlebars.helpers.collection;
Thorax.View.collection = Handlebars.helpers.collection = function(collection, options) {
  if (arguments.length === 1) {
    options = collection;
    collection = this._view.collection;
  }
  if (options.hash['loading-view'] || options.hash['loading-template']) {
    var item, collectionElement;
    collection.bind(loadStart, Thorax.loadHandler(_.bind(function() {
      collectionElement = this._view._getCollectionElement(collection);
      if (collection.length === 0) {
        collectionElement.empty();
      }
      if (options.hash['loading-view']) {
        var view = this.view(options.hash['loading-view'], this);
        view.render(options.hash['loading-template']);
        item = view;
      } else {
        item = this.template(options.hash['loading-template'], this);
      }
      this._view.appendItem(collection, item, collection.length, {
        collectionElement: collectionElement
      });
      collectionElement.children().last().attr('data-loading-element', collection.cid);
    }, this), _.bind(function() {
      collectionElement = collectionElement || this._view._getCollectionElement(collection);
      collectionElement.find('[data-loading-element="' + collection.cid + '"]').remove();
    }, this)));
  }
  var clonedOptionsHash = _.clone(options.hash);
  delete clonedOptionsHash['loading-view'];
  delete clonedOptionsHash['loading-template'];
  var clonedOptions = _.clone(options);
  clonedOptions.hash = clonedOptionsHash;
  return oldCollectionHelper.call(this, collection, clonedOptions);
};

})();
