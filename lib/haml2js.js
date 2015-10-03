var fs = require('fs');
var exec = require('child_process').exec;
var async = require('async');
var path = require('path');

var TPL = fs.readFileSync(path.join(__dirname, './basic.tpl'), 'utf8'),
  SINGLE_MODULE_TPL = fs.readFileSync(path.join(__dirname, './singleModule.tpl'), 'utf8');

module.exports = function createHaml2JsPreprocessor(logger, basePath, config) {
  config = typeof config === 'object' ? config : {};

  var log = logger.create('preprocessor.haml2js');
  var template = config.moduleName ? SINGLE_MODULE_TPL : TPL;
  var stripPrefix = new RegExp('^' + (config.stripPrefix || ''));
  var prependPrefix = config.prependPrefix || '';
  var cacheIdFromPath = config.cacheIdFromPath || function(filepath) {
    return prependPrefix + filepath.replace(stripPrefix, '');
  };

  var queue = async.queue(hamlWorker, 2);

  return function asyncProcess(content, file, done) {
    queue.push({
      file: file,
      done: done
    });
  };

  function hamlWorker(task, next) {
    var file = task.file,
      done = task.done;

    log.debug('Processing "%s".', file.originalPath);

    var hamlPath = cacheIdFromPath(file.originalPath.replace(basePath + '/', ''));
    var htmlPath = hamlPath.replace(/\.haml|\.html\.haml/, '.html');
    file.path = file.path + '.js';

    compileHaml(file.originalPath, function (err, compiled) {
      next();

      if (err) {
        return done(err, null);
      }

      done(null, interpolate(template, {
        moduleName: config.moduleName || htmlPath,
        path: htmlPath,
        content: compiled,
      }));
    });
  }
};

module.exports.$inject = ['logger', 'config.basePath', 'config.ngHaml2JsPreprocessor'];

function interpolate(tpl, options) {
  return tpl
    .replace(/\{\{MODULE\}\}/g,   JSON.stringify(options.moduleName))
    .replace(/\{\{NAME\}\}/g,     JSON.stringify(options.path))
    .replace(/\{\{CONTENT\}\}/g,  JSON.stringify(options.content));
}

function compileHaml(filePath, callback) {
  exec('haml ' + filePath, callback);
}