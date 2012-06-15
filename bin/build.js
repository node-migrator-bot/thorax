var fs = require('fs'),
    path = require('path'),
    _ = require('underscore'),
    childProcess = require('child_process'),
    exec = childProcess.exec,
    async = require('async'),
    mkdirp = require('mkdirp'),
    packageJSON = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'))),
    deepExtend = require(path.join(__dirname, 'deep-extend.js'));

function execute(commands, callback) {
  //console.log(commands.join("\n"));
  exec(commands.join(";"), function(error, stdout, stderr) {
    //if (stdout) {
    //  console.log(stdout);
    //}
    if (stderr) {
      console.log(stderr);
    }
    callback();
  });
}

function buildPackage(name, target, complete) {
  var build = packageJSON.builds[name],
      lumbarJSONLocation = path.join(target, 'lumbar.json'),
      pacakgeJSONLocation = path.join(target, 'package.json'),
      oldLumbarJSON,
      oldPackageJSON,
      newPackageJSON,
      newLumbarJSON;
  console.log('lumbarJSONLocation',lumbarJSONLocation);
  if (path.existsSync(lumbarJSONLocation)) {
    console.log(fs.readFileSync(lumbarJSONLocation).toString())
    oldLumbarJSON = JSON.parse(fs.readFileSync(lumbarJSONLocation));
  }
  if (path.existsSync(pacakgeJSONLocation)) {
    oldPackageJSON = JSON.parse(fs.readFileSync(pacakgeJSONLocation));
  }
  function buildFiles() {
    async.forEachSeries(_.map(build.files, function(targetPath, sourcePath) {
      return {
        targetPath: targetPath,
        sourcePath: sourcePath
      };
    }), function(fileInfo, next) {
      execute(['cp -r ' + path.join(__dirname, '..', fileInfo.sourcePath) + '/ ' + path.join(target, fileInfo.targetPath)], next);
    }, function() {
      console.log('done building ',name);
      if (path.existsSync(lumbarJSONLocation)) {
        newLumbarJSON = JSON.parse(fs.readFileSync(lumbarJSONLocation));
        console.log('oldLumbarJSON', oldLumbarJSON);
        console.log('newLumbarJSON', newLumbarJSON );
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
      complete();
    });
  }
  function buildBuilds(completeBuildBuilds) {
    async.forEachSeries(_.clone(build.builds), function(subBuild, next) {
      buildPackage(subBuild, target, next);
    }, completeBuildBuilds);
  }
  if (build.builds) {
    buildBuilds(buildFiles);
  } else {
    buildFiles();
  }
}

_.each(packageJSON.builds, function(build, name) {
  var targetDirectory = path.join(__dirname, '..', 'public', 'builds', name);
  mkdirp(targetDirectory, function() {
    buildPackage(name, targetDirectory, function() {
      console.log('building', targetDirectory);
    });
  });
});

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

*/
