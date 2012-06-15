var fs = require('fs'),
    path = require('path'),
    _ = require('underscore'),
    execSync = require('execSync'),
    mkdirp = require('mkdirp'),
    packageJSON = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'))),
    deepExtend = require(path.join(__dirname, 'deep-extend.js'));


function buildPackage(name, target) {
  var build = packageJSON.builds[name];
  if (build.builds) {
    build.builds.forEach(function(subBuild) {
      buildPackage(subBuild, target);
    });
  }
  if (build.files) {
    _.each(build.files, function(targetPath, sourcePath) {
      var response = execSync.stdout('cp -r ' + path.join(__dirname, '..', sourcePath) + '/ ' + path.join(target, targetPath));
      console.log(response);
    });
  }
}
_.each(packageJSON.builds, function(build, name) {
  var targetDirectory = path.join(__dirname, '..', 'public', 'builds', name);
  mkdirp.sync(targetDirectory);
  buildPackage(name, targetDirectory);
});

console.log('packageJSON',packageJSON);

/*
var port = process.env.PORT || 3000,
    fs = require('fs'),
    path = require('path'),
    _ = require('underscore'),
    deepExtend = require(path.join(__dirname, 'deep-extend.js')),
    express = require('express'),
    childProcess = require('child_process'),
    app = express.createServer(),
    exec = childProcess.exec,
    spawn = childProcess.spawn,
    packageJSON = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'))),
    createBaseDirectoryStructure = function(repoLocation) {
      return [
        'mkdir ' + path.join(repoLocation, 'public'),
        'mkdir ' + path.join(repoLocation, 'styles'),
        'mkdir ' + path.join(repoLocation, 'server'),
        'mkdir ' + path.join(repoLocation, 'templates'),
        'mkdir ' + path.join(repoLocation, 'js', 'collections'),
        'mkdir ' + path.join(repoLocation, 'js', 'models'),
        'mkdir ' + path.join(repoLocation, 'js', 'routers'),
        'mkdir ' + path.join(repoLocation, 'js', 'views')
        ].join(';');
    },
    execute = function(commands, callback) {
      console.log(commands.join("\n"));
      exec(commands.join(";"), function(error, stdout, stderr) {
        if (stdout) {
          console.log(stdout);
        }
        if (stderr) {
          console.log(stderr);
        }
        callback();
      });
    },
    createProject = function(repos, callback) {
      var location = 'thorax-' + (new Date).getTime().toString(),
          lumbarJSONLocation = path.join(location, 'lumbar.json'),
          pacakgeJSONLocation = path.join(location, 'package.json');
      function mergeRepo(repo, complete) {
        if (!repo) {
          complete();
        } else {
          var repoLocation = path.join(__dirname, 'tmp' + '-' + (new Date()).getTime().toString());
          execute([
            'git clone git://github.com/' + repo + '.git ' + repoLocation,
            createBaseDirectoryStructure(repoLocation),
            'rm -rf ' + path.join(repoLocation, '.git')
          ], function() {
            var oldLumbarJSON, oldPackageJSON;
            if (path.existsSync(lumbarJSONLocation)) {
              oldLumbarJSON = JSON.parse(fs.readFileSync(lumbarJSONLocation));
            }
            if (path.existsSync(pacakgeJSONLocation)) {
              oldPackageJSON = JSON.parse(fs.readFileSync(pacakgeJSONLocation));
            }
            execute([
              'cp -r ' + repoLocation + '/ ' + location,
              'rm -rf ' + repoLocation
            ], function() {
              var newLumbarJSON, newPackageJSON;
              if (path.existsSync(lumbarJSONLocation)) {
                newLumbarJSON = JSON.parse(fs.readFileSync(lumbarJSONLocation));
              }
              if (path.existsSync(pacakgeJSONLocation)) {
                newPackageJSON = JSON.parse(fs.readFileSync(pacakgeJSONLocation));
              }
              if (oldLumbarJSON && newLumbarJSON) {
                fs.writeFileSync(lumbarJSONLocation, JSON.stringify(deepExtend(oldLumbarJSON, newLumbarJSON), null, 2));
              }
              if (oldPackageJSON && newPackageJSON) {
                fs.writeFileSync(pacakgeJSONLocation, JSON.stringify(deepExtend(oldPackageJSON, newPackageJSON), null, 2));
              }
              mergeRepo(repos.shift(), complete);
            });
          });
        }
      }
      execute(['mkdir ' + location], function() {
        mergeRepo(repos.shift(), function() {
          callback(location);
        });
      });
    },
    sendProject = function(location, response, callback) {
      var zip = spawn('tar', ['-cz', location]);
      response.contentType('zip');
      zip.stdout.on('data', function(data) {
        response.write(data);
      });
      zip.on('exit', function(code) {
        if (code !== 0) {
          response.statusCode = 500;
          console.log('tar process exited with code ' + code);
          callback();
        } else {
          callback();
        }
      });
    },
    destroyProject = function(location, callback) {
      execute(['rm -rf ' + location], callback);
    };

    
app.use(express.logger());
app.use(express.bodyParser());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/packages.json', function(request, response) {
  response.send(JSON.stringify(packageJSON.packages));
});

app.post('/thorax.zip', function(request, response) {
  var location = 'thorax.boilerplate.html';
  createProject(request.body.repos || [], function(location) {
    sendProject(location, response, function() {
      destroyProject(location, function() {
        response.end();
      });
    });
  });
});

console.log("Listening on port " + port);
app.listen(port);
*/
