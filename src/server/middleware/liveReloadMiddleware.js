/**
 * Copyright 2017-present, Callstack.
 * All rights reserved.
 */

/**
 * Live reload middleware
 */
function liveReloadMiddleware(expressContext) {
  let watchers = [];
  const headers = {
    'Content-Type': 'application/json; charset=UTF-8',
  };

  function notifyAllWatchers() {
    watchers.forEach(watcher => {
      watcher.res.writeHead(205, headers);
      watcher.res.end(JSON.stringify({ changed: true }));
    });

    watchers = [];
  }

  // pass live reload to forks' parent
  /* eslint-disable no-param-reassign */
  expressContext.liveReload = notifyAllWatchers;

  return (req, res, next) => {
    /**
     * React Native client opens connection at `/onchange`
     * and awaits reload signal (http status code - 205)
     */

    if (req.path === '/onchange') {
      const watcher = { req, res };

      watchers.push(watcher);

      req.on('close', () => {
        watchers.splice(watchers.indexOf(watcher), 1);
      });

      return;
    }

    if (req.path === '/reloadapp') {
      notifyAllWatchers();
      res.end();
      return;
    }

    next();
  };
}

module.exports = liveReloadMiddleware;
