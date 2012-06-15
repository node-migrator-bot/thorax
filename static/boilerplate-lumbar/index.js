var childProcess = require('child_process'),
  exec = childProcess.exec,
  spawn = childProcess.spawn,
  fs = require('fs'),
  path = require('path'),
  execute = function(commands, callback) {
    console.log(commands.join("\n"));
    exec(commands.join(";"), function(error, stdout, stderr) {
      if (stdout) {
        console.log(stdout);
      }
      if (stderr) {
        console.log(stderr);
      }
      callback && callback();
    });
  },
  startServer = function() {
    var express = require('express'),
      portscanner = require('portscanner'),
      argv = require('optimist').argv,
      port = process.env.PORT;
    
    if (argv.watch) {
      var lumbar = spawn('lumbar', ['watch', path.join(__dirname, 'lumbar.json'), path.join(__dirname, 'public')]);
      lumbar.stdout.on('data', function(data) {
        process.stdout.write(data.toString());
      });
      lumbar.stderr.on('data', function(data) {
        process.stdout.write(data.toString());
      });
    }
    
    var server = express.createServer();
    server.use(express.logger());
    server.use(express.bodyParser());
    server.use(express.static(path.join(__dirname, 'public')));
    
    function listen(foundPort) {
      console.log('Express server listening on port ' + foundPort);
      server.listen(foundPort);
    }

    if (!port) {
      portscanner.findAPortNotInUse(port, port + 25, 'localhost', function(error, foundPort) {
        listen(foundPort);
      });
    } else {
      listen(port);
    }
    
    fs.readdirSync(path.join(__dirname, 'server')).forEach(function(file) {
      if (file.match(/\.js$/)) {
        //second parameter is reserved for future use, secureServer
        require(path.join(__dirname, 'server', file))(server, null, argv);
      }
    });
  };

if (!path.existsSync(path.join(__dirname, 'node_modules'))) {
  execute(['npm install'], startServer);
} else {
  startServer();
}
