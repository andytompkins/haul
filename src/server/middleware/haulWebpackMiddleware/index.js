/**
 * Copyright 2017-present, Callstack.
 * All rights reserved.
 * 
 * @flow
 */
/* eslint-disable consistent-return */

const net = require('net');
const xpipe = require('xpipe');

const createFork = require('./utils/createFork');
const getRequestDataFromPath = require('./utils/getRequestDataFromPath');
const EVENTS = require('./utils/eventNames');
const RequestQueue = require('./utils/requestQueue');
const runAdbReverse = require('./utils/runAdbReverse');
const logger = require('../../../logger');

type ConfigOptionsType = {
  root: string,
  dev: boolean,
  minify: boolean,
  port: number,
  platform: string,
};

type MiddlewareOptions = {
  configPath: string,
  configOptions: ConfigOptionsType,
  expressContext: { liveReload: () => void },
};

/**
 * Gets proper IPC socket name, platform specific
 * @param {string} plat 
 */
const getSocket = (plat: string) =>
  xpipe.eq(`/tmp/HAUL_SOCKET_${plat}_.socket`);

/**
 * Kills all forks and closes all connections
 * @param {string} err Error message to display/throw
 */
const closeAllConnections = (err: typeof Error | string) => {
  logger.info('Shutting down Haul.');

  err && logger.error(err.message);

  Object.keys(FORKS).forEach(plat => {
    FORKS[plat].fork.kill();
    FORKS[plat].server.close();
  });
  process.exit(0);
};

const FORKS = {};

/**
 * Throws error, saying which function failed
 * @param {string} funcName 
 */
const reportError = (funcName: string) => {
  closeAllConnections();
  throw new Error(
    `Middleware: No platform, ID or event to sendMessage. | ${funcName}`
  );
};

/**
 * on bundleSuccess, sends bundle to all rememing connections
 * @param {string} platform 
 * @param {string} socket 
 */
const createSocketServer = (platform: string) => {
  return net.createServer({ allowHalfOpen: true }, connection => {
    let bundle = '';

    connection.setEncoding('utf-8');
    connection.on('data', chunk => {
      bundle += chunk;
    });
    connection.on('end', () => {
      FORKS[platform].listeners.flushQueue(response => {
        response.writeHead(200, { 'Content-Type': 'application/javascript' });
        response.end(bundle);
      });

      connection.end();
    });
    connection.on('close', () => {
      bundle = '';
    });
  });
};

/**
 * Sends a message to worker, with payload
 * @param {string} platform 
 * @param {Object} res express 'res'
 * @param {string} event 
 */
const sendMessage = (platform: string, res, event: string) => {
  if (!platform || !event) {
    reportError('sendMessage');
    return;
  }

  const owner = FORKS[platform];
  const ID = owner.listeners.addItem(res); // new task ID

  owner.fork.send({
    ID,
    event,
  });
};

/**
 * Handles received messages from fork
 * @param {Object} data {ID, event, payload}
 * @param {Object} expressContext {liveReload} attached methods from other middlewares
 * @param {*} req express 'req'
 * @param {*} res express 'res'
 * @param {*} next express 'next'
 */
const receiveMessage = (data, expressContext, req, res, next) => {
  const { platform, ID, event, payload } = data;

  if (ID === undefined || !platform || !event) {
    reportError('receiveMessage');
    return;
  }

  const owner = FORKS[platform];

  switch (event) {
    case EVENTS.buildFinished: {
      // all request has been flushed, do nothing
      break;
    }
    case EVENTS.buildFailed: {
      // todo: .error and .warnings coming
      // should handle warnings?
      const response = owner.listeners.getSpecific(ID);
      logger.error(`${platform}:\n`, payload.error);
      response.type('text/javascript');
      response.status(500);
      response.end(`${payload.error}`);
      break;
    }
    case EVENTS.errorMessaging: {
      closeAllConnections();
      throw new Error(`BAD COMMUNICATIONS: ${payload}`);
    }

    case EVENTS.liveReload: {
      // all request has been flushed, do nothing
      const { liveReload } = expressContext;
      liveReload();
      break;
    }

    default: {
      logger.warn('Uhandled Event:\n', event);
      next();
    }
  }
};

module.exports = function haulMiddlewareFactory(options: MiddlewareOptions) {
  return function webpackHaulMiddleware(req, res, next) {
    const { expressContext } = options;
    const { filename, platform } = getRequestDataFromPath(req.path);

    if (!platform || !filename) return next();
    const socket = getSocket(platform);

    // Fork creation
    if (!FORKS[platform]) {
      const platformSpecifics = {};

      platformSpecifics.fork = createFork(
        platform,
        `index.${platform}.bundle`,
        process.cwd(),
        __dirname,
        options,
        socket
      );

      platformSpecifics.listeners = new RequestQueue();
      platformSpecifics.fork.on('message', data =>
        receiveMessage(data, expressContext, req, res, next)
      );

      platformSpecifics.server = createSocketServer(platform).listen(socket);

      FORKS[platform] = platformSpecifics;

      if (platform === 'android') {
        const { port } = options && options.configOptions;
        runAdbReverse(port);
      }
    }

    // request bundle
    sendMessage(platform, res, EVENTS.requestBuild);
  };
};

process.on('uncaughtException', err => {
  closeAllConnections(err);
});

process.on('SIGINT', () => {
  closeAllConnections();
});
