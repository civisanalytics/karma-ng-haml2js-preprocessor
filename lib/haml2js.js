var util = require('util');
var execSync = require('child_process').execSync;

var TEMPLATE = 'angular.module(\'%s\', []).run(function($templateCache) {\n' +
    '  $templateCache.put(\'%s\',\n    \'%s\');\n' +
    '});\n';

var SINGLE_MODULE_TPL = '(function(module) {\n' +
    'try {\n' +
    '  module = angular.module(\'%s\');\n' +
    '} catch (e) {\n' +
    '  module = angular.module(\'%s\', []);\n' +
    '}\n' +
    'module.run(function($templateCache) {\n' +
    '  $templateCache.put(\'%s\',\n    \'%s\');\n' +
    '});\n' +
    '})();\n';

var escapeContent = function(content) {
  return content.replace(/\\/g, '\\\\').replace(/'/g, '\\\'').replace(/\r?\n/g, '\\n\' +\n    \'');
};

var createHaml2JsPreprocessor = function(logger, basePath, config) {
  config = typeof config === 'object' ? config : {};

  var log = logger.create('preprocessor.haml2js');
  var moduleName = config.moduleName;
  var stripPrefix = new RegExp('^' + (config.stripPrefix || ''));
  var prependPrefix = config.prependPrefix || '';
  var cacheIdFromPath = config && config.cacheIdFromPath || function(filepath) {
    return prependPrefix + filepath.replace(stripPrefix, '');
  };

  return function(content, file, done) {
    log.debug('Processing "%s".', file.originalPath);

    var hamlPath = cacheIdFromPath(file.originalPath.replace(basePath + '/', ''));
    var htmlPath = hamlPath.replace(/\.haml|\.html\.haml/, '.html');

    file.path = file.path + '.js';
  
    try {
      var stdout = execSync('haml ' + file.originalPath);
      var escapedContents = escapeContent(stdout.toString());
      var results;
      if (moduleName) {
        results = util.format(SINGLE_MODULE_TPL, moduleName, moduleName, htmlPath, escapedContents);
      } else {
        results = util.format(TEMPLATE, htmlPath, htmlPath, escapedContents);
      }
      done(null, results);
    } catch (e) {
      log.error('%s in %s', e.message || e.name, file.originalPath);
      done(e, null);
    }
  };
};

createHaml2JsPreprocessor.$inject = ['logger', 'config.basePath', 'config.ngHaml2JsPreprocessor'];

module.exports = createHaml2JsPreprocessor;
