/* eslint-env node */
var fs = require('fs');
var spawn = require('child_process').spawn;
var util = require('util');
var path = require('path');
var EventEmitter = require('events').EventEmitter;
var async = require('async');

var TPL = fs.readFileSync(path.join(__dirname, './basic.tpl'), 'utf8'),
  SINGLE_MODULE_TPL = fs.readFileSync(path.join(__dirname, './singleModule.tpl'), 'utf8'),
  SEPARATOR = '__SEPARATOR__' + Math.random().toString(16).slice(2),
  COMPILER_SCRIPT = path.join(__dirname, './compiler.rb');

module.exports = function createHaml2JsPreprocessor(logger, basePath, config) {
  config = typeof config === 'object' ? config : {};

  var log = logger.create('preprocessor.haml2js');
  var template = config.moduleName ? SINGLE_MODULE_TPL : TPL;
  var stripPrefix = new RegExp('^' + (config.stripPrefix || ''));
  var prependPrefix = config.prependPrefix || '';
  var cacheIdFromPath = config.cacheIdFromPath || function(filePath) {
    return prependPrefix + filePath.replace(stripPrefix, '');
  };

  var queue = async.queue(hamlWorker, 1);
  queue.pause();
  var compiler = new Compiler({mocks: config.mocks});

  compiler.on('ready', function () {
    queue.resume();
  });

  return function asyncProcess(content, file, done) {
    queue.push({
      file: file,
      done: done
    });
  };

  function hamlWorker(task, next) {
    var file = task.file,
      done = task.done;

    log.debug('Processing %s.', file.originalPath);

    var hamlPath = cacheIdFromPath(file.originalPath.replace(basePath + '/', ''));
    var htmlPath = hamlPath.replace(/\.haml|\.html\.haml/, '.html');
    file.path = file.path + '.js';

    compiler.compile(file.originalPath, function (err, compiled) {
      process.nextTick(next);

      if (err) {
        log.error('Processing %s failed:\n%s', file.originalPath, err);
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

function Compiler(config) {
  var compiler = this,
    haml;

  this.failed = false;

  haml = this.haml = spawn('ruby', [COMPILER_SCRIPT], {
    stdio: 'pipe',
  });

  haml.stdin.setEncoding('utf8');
  haml.stdout.setEncoding('utf8');
  haml.stderr.setEncoding('utf8');

  haml.stdout.on('data', wait);

  function wait(chunk) {
    if (chunk !== Compiler.READY) {
      return compiler.emit('error', new Error('Unexpected error'));
    }

    haml.stdout.removeListener('data', wait);

    haml.stdin.write(SEPARATOR);
    haml.stdin.write('\n');

    haml.stdin.write('METHODS:');
    haml.stdin.write('\n');
    (config.mocks || []).forEach(function (methodName) {
      haml.stdin.write(methodName);
      haml.stdin.write('\n');
    });
    haml.stdin.write(SEPARATOR);
    haml.stdin.write('\n');

    setTimeout(function () {
      if (!compiler.failed) compiler.emit('ready');
    });
  }

  haml
    .on('error', onError)
    .on('exit', onCloseOrExit)
    .on('close', onCloseOrExit);

  haml.stderr.on('data', onStdErr);

  function onError(err) {
    compiler.error = err;
    emitError();
  }

  function onStdErr(chunk) {
    compiler.stderr = (this.stderr || '') + chunk;
  }

  function onCloseOrExit(code, sig) {
    compiler.code = code;
    compiler.signal = sig;
    emitError();
  }

  function emitError() {
    if (compiler.code === 0) return;
    compiler.failed = true;
    compiler.emit('error', new CompilerError(compiler.code, {
      err: compiler.err,
      signal: compiler.signal,
      stderr: compiler.stderr
    }));
  }
}

util.inherits(Compiler, EventEmitter);

Compiler.ERROR_PREFIX = 'error:\n';
Compiler.READY = '**';

Compiler.prototype.compile = function(filePath, callback) {
  var haml = this.haml,
    compiled = '';

  if (this.failed) return;

  haml.stdout.on('data', onData);

  function onData(chunk) {
    var match;
    compiled += chunk;
    if (!(match = compiled.match(SEPARATOR))) return;

    haml.stdout.removeListener('data', onData);
    compiled = compiled.slice(0, match.index);

    if (compiled.indexOf(Compiler.ERROR_PREFIX) === 0) {
      callback(compiled.slice(Compiler.ERROR_PREFIX.length), null);
    } else {
      callback(null, compiled);
    }
  }

  haml.stdin.write(filePath);
  haml.stdin.write('\n');
};

function CompilerError(code, details) {
  Error.captureStackTrace(this, CompilerError);

  this.message = util.format('Haml compiler error, code %d', code);

  if (details.signal) {
    this.message += util.format(', signal %s.', details.signal);
  } else {
    this.message += '.'
  }

  if (details.error) {
    var error = details.error.stack || details.error.message || details.error;
    this.stack += util.format('\nReceived error:\n%s', error);
  }

  if (details.stderr) {
    this.stack += util.format('\nCompiler stderr:\n%s', details.stderr);
  }
}

util.inherits(CompilerError, Error);

function interpolate(tpl, options) {
  return tpl
    .replace(/\{\{MODULE\}\}/g,   JSON.stringify(options.moduleName))
    .replace(/\{\{NAME\}\}/g,     JSON.stringify(options.path))
    .replace(/\{\{CONTENT\}\}/g,  JSON.stringify(options.content));
}
