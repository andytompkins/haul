/* eslint-disable no-param-reassign, no-debugger, no-empty */

const path = require('path');

module.exports = function Shared(context) {
  const shared = {
    compilerDone(stats) {
      context.state = true;
      context.webpackStats = stats;

      process.nextTick(() => {
        if (!context.state) return;
        const cbs = context.callbacks;
        context.callbacks = [];
        cbs.forEach(cb => {
          cb(stats);
        });
      });
    },

    compilerInvalid(...args) {
      context.state = false;
      // resolve async
      if (args.length === 2 && typeof args[1] === 'function') {
        const callback = args[1];
        callback();
      }
    },

    startWatch() {
      const { compiler } = context;
      compiler.watch({}, shared.handleCompilerCb);
    },

    handleCompilerCb(err) {
      if (err) {
        context.onError(err);
      }
    },

    handleRequest(filename, requestProcess) {
      if (context.state) {
        const pathToFile = path.join(process.cwd(), filename);
        if (context.fs.statSync(pathToFile).isFile()) {
          return requestProcess(context.webpackStats);
        }
      }

      return context.callbacks.push(requestProcess);
    },
  };

  context.compiler.plugin('done', shared.compilerDone);
  context.compiler.plugin('invalid', shared.compilerInvalid);
  context.compiler.plugin('watch-run', shared.compilerInvalid);
  context.compiler.plugin('run', shared.compilerInvalid);
  shared.startWatch();

  return shared;
};
