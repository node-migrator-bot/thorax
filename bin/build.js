var fs = require('fs'),
    path = require('path'),
    _ = require('underscore'),
    childProcess = require('child_process'),
    exec = childProcess.exec,
    async = require('async'),
    mkdirp = require('mkdirp'),
    watchTree = require('fs-watch-tree').watchTree,
    packageJSON = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'))),
    deepExtend = require(path.join(__dirname, 'deep-extend.js'));

function execute(commands, callback) {
  exec(commands.join(";"), function(error, stdout, stderr) {
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
  if (path.existsSync(lumbarJSONLocation)) {
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

function buildAllPackages() {
  async.forEachSeries(_.map(packageJSON.builds, function(build, name) {
    return {
      name: name,
      build: build
    };
  }), function(item, next) {
    var build = item.build;
    var name = item.name;
    var targetDirectory = path.join(__dirname, '..', 'public', 'builds', name);
    mkdirp(targetDirectory, function() {
      buildPackage(name, targetDirectory, function() {
        execute(['zip ' + targetDirectory + '.zip -r ' + targetDirectory], function() {
          console.log('built', name);
          next();
        });
      });
    });
  });
}
buildAllPackages();

var watchCallback = _.throttle(function(event) {
  buildAllPackages();
}, 1000);
watchTree(path.join(__dirname, '..', 'static'), watchCallback);
watchTree(path.join(__dirname, '..', 'lib'), watchCallback);
