var internalViewEvents = {};

_.extend(View.prototype, {
  //allow events hash to specify view, collection and model events
  //as well as DOM events. Merges Thorax.View.events with this.events
  delegateEvents: function(events) {
    this.undelegateEvents && this.undelegateEvents();
    //bindModelAndCollectionEvents on this.constructor.events and this.events
    //done in _configure
    this.registerEvents(this.constructor.events);
    if (this.events) {
      this.registerEvents(this.events);
    }
    if (events) {
      this.registerEvents(events);
      bindModelAndCollectionEvents.call(this, events);
    }
  },

  registerEvents: function(events) {
    processEvents.call(this, events).forEach(this._addEvent, this);
  },

  //params may contain:
  //- name
  //- originalName
  //- selector
  //- type "view" || "DOM"
  //- handler
  _addEvent: function(params) {
    if (params.type === 'view') {
      this.bind(params.name, params.handler, this);
    } else {
      var boundHandler = containHandlerToCurentView(bindEventHandler.call(this, params.handler), this.cid);
      if (params.selector) {
        //TODO: determine why collection views and some nested views
        //need defered event delegation 
        if (typeof jQuery !== 'undefined' && $ === jQuery) {
          _.defer(_.bind(function() {
            this.$el.delegate(params.selector, params.name, boundHandler);
          }, this));
        } else {
          this.$el.delegate(params.selector, params.name, boundHandler);
        }
      } else {
        this.$el.bind(params.name, boundHandler);
      }
    }
  },

  freeze: function(modelOrCollection) {
    if (this.model && (modelOrCollection === this.model || !modelOrCollection)) {
      this._events.model.forEach(function(event) {
        this.model.unbind(event[0], event[1]);
      }, this);
    }
    _.each(this._partials, function(partial, cid) {
      partial.freeze();
    });
  }
});

_.extend(View, {
  //events for all views
  events: {
    model: {},
    collection: {}
  },
  registerEvents: function(events) {
    for(var name in events) {
      if (name === 'model' || name === 'collection') {
        for (var _name in events[name]) {
          addEvent(this.events[name], _name, events[name][_name]);
        }
      } else {
        addEvent(this.events, name, events[name]);
      }
    }
  },
  unregisterEvents: function(events) {
    if (typeof events === 'undefined') {
      this.events = {
        model: {},
        collection: {}
      };
    } else if (typeof events === 'string' && arguments.length === 1) {
      if (events === 'model' || events === 'collection') {
        this.events[events] = {};
      } else {
        this.events[events] = [];
      }
    //remove collection or model events
    } else if (arguments.length === 2) {
      this.events[arguments[0]][arguments[1]] = [];
    }
  }
});

function containHandlerToCurentView(handler, cid) {
  return function(event) {
    var containing_view_element = $(event.target).closest('[' + viewNameAttributeName + ']');
    if (!containing_view_element.length || containing_view_element[0].getAttribute(viewCidAttributeName) == cid) {
      handler(event);
    }
  };
}

var domEvents = [
  'mousedown', 'mouseup', 'mousemove', 'mouseover', 'mouseout',
  'touchstart', 'touchend', 'touchmove',
  'click', 'dblclick',
  'keyup', 'keydown', 'keypress',
  'submit', 'change',
  'focus', 'blur'
];

function bindEventHandler(callback) {
  var method = typeof callback === 'function' ? callback : this[callback];
  if (!method) {
    throw new Error('Event "' + callback + '" does not exist');
  }
  return _.bind(method, this);
}

function processEvents(events) {
  if (_.isFunction(events)) {
    events = events.call(this);
  }
  var processedEvents = [];
  for (var name in events) {
    if (name !== 'model' && name !== 'collection') {
      if (name.match(/,/)) {
        name.split(/,/).forEach(function(fragment) {
          processEventItem.call(this, fragment.replace(/(^[\s]+|[\s]+$)/g, ''), events[name], processedEvents);
        }, this);
      } else {
        processEventItem.call(this, name, events[name], processedEvents);
      }
    }
  }
  return processedEvents;
}

function processEventItem(name, handler, target) {
  if (_.isArray(handler)) {
    for (var i = 0; i < handler.length; ++i) {
      target.push(eventParamsFromEventItem.call(this, name, handler[i]));
    }
  } else {
    target.push(eventParamsFromEventItem.call(this, name, handler));
  }
}

function addEvent(target, name, handler) {
  if (!target[name]) {
    target[name] = [];
  }
  if (_.isArray(handler)) {
    for (var i = 0; i < handler.length; ++i) {
      target[name].push(handler[i]);
    }
  } else {
    target[name].push(handler);
  }
}

var eventSplitter = /^(\S+)(?:\s+(.+))?/;

function eventParamsFromEventItem(name, handler) {
  var params = {
    originalName: name,
    handler: typeof handler === 'string' ? this[handler] : handler
  };
  var match = eventSplitter.exec(name);
  params.name = match[1];
  if (isDOMEvent(params.name)) {
    params.type = 'DOM';
    params.name += '.delegateEvents' + this.cid;
    params.selector = match[2];
  } else {
    params.type = 'view';
  }
  return params;
}

function isDOMEvent(name) {
  return !(!name.match(/\s+/) && domEvents.indexOf(name) === -1);
}

//model/collection events, to be bound/unbound on setModel/setCollection
function processModelOrCollectionEvent(events, type) {
  for (var _name in events[type] || {}) {
    if (_.isArray(events[type][_name])) {
      for (var i = 0; i < events[type][_name].length; ++i) {
        this._events[type].push([_name, bindEventHandler.call(this, events[type][_name][i])]);
      }
    } else {
      this._events[type].push([_name, bindEventHandler.call(this, events[type][_name])]);
    }
  }
}

function bindModelAndCollectionEvents(events) {
  if (!this._events) {
    this._events = {
      model: [],
      collection: []
    };
  }
  processModelOrCollectionEvent.call(this, events, 'model');
  processModelOrCollectionEvent.call(this, events, 'collection');
}

