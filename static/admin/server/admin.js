module.exports = function(server, secureServer, argv) {
  if (argv.admin) {
    var path = require('path'),
    _ = require('underscore'),
    fs = require('fs'),
    exec = require('child_process').exec,
    pathPrefix = '/admin';
    io = require('socket.io');

    function readFile(file, callback) {
      fs.readFile(relativePath(file), callback);
    }
    
    function writeFile(file, contents, callback) {
      fs.writeFile(relativePath(file), contents, callback);
    }

    function relativePath(filename) {
      return path.join(__dirname, '..', filename);
    }

    [
      //open file
      ['get', '/open', function(request, response) {
        console.log('open!');
        var command = request.query.editor + ' ' + relativePath(request.query.path);
        console.log(command);
        exec(command, function(){});
        response.send();
      }],
    
      //read lumbar config
      ['get', '/lumbar.json', function(request, response) {
        readFile('lumbar.json', function(err, contents) {
          response.send(contents);
        });
      }],
      //write lumbar config
      ['post', '/lumbar.json', function(request, response) {
        console.log(JSON.stringify(request.body, null, 2));
        return response.send();
        writeFile('lumbar.json', JSON.stringify(request.body, null, 2), function() {
          response.send();
        });
      }],
      //
      //read file
      ['get', '/file', function(request, response) {
        readFile(request.query.path, function(err, contents) {
          response.send(err ? 500 : contents);
        });
      }],
      //write file
      ['post', '/file', function(request, response) {
        writeFile(request.query.path, request.body.content, function() {
          response.send();
        });
      }],
      //delete file
      ['del', '/file', function(request, response) {
    
      }],
      //batch create empty files if they do not exist
      ['put', '/files', function(request, response) {
    
      }]
    ].forEach(function(method) {
      server[method[0]](pathPrefix + method[1], method[2]);
    });
  }

  //watch for changes to the public directory
  function debounce(func, wait) {
    var timeout;
    return function() {
      var context = this, args = arguments;
      var later = function() {
        timeout = null;
        func.apply(context, args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  var listener = io.listen(server);
  listener.set('log level', 1);

  if (secureServer) {
    var secureListener = io.listen(secureServer);
    secureListener.set('log level', 1);
  }

  var emitter = debounce(function() {
    listener.sockets.emit('reload');
    if (secureListener) {
      secureListener.sockets.emit('reload');
    }
  }, 25);

  var watchPath = path.join(__dirname, '..', 'public'),
      lumbarJSON = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'lumbar.json')));
  _.each(lumbarJSON.modules, function(moduleName, key) {
    fs.watchFile(path.join(__dirname, '..', 'public', key + '.js'), emitter);
    fs.watchFile(path.join(__dirname, '..', 'public', key + '.css'), emitter);
  });
};
