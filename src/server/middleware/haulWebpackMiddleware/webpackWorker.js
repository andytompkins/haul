/**
 * Copyright 2017-present, Callstack.
 * All rights reserved.
 * 
 * @flow
 */
/* Required modules */
require('babel-register');

const path = require('path');
const webpack = require('webpack');
const MemoryFileSystem = require('memory-fs');
const net = require('net');

/**
 * Get env vars
 */
const {
  HAUL_PLATFORM,
  HAUL_OPTIONS, // middleware options
  HAUL_FILEOUTPUT,
  HAUL_DIRECTORY,
  HAUL_SOCKET,
} = process.env;

/**
 * Import custom from 'utils' of this middleware
 */
const workerShared = require(path.resolve(
  HAUL_DIRECTORY,
  './utils/workerShared'
));

const EVENTS = require(path.resolve(HAUL_DIRECTORY, './utils/eventNames'));
/**
 * Get Webpack config
 */
const middlewareOptions = JSON.parse(HAUL_OPTIONS);
const { configPath, configOptions } = middlewareOptions;
const getConfig = require(path.resolve(HAUL_DIRECTORY, './utils/getConfig'));
const config = getConfig(configPath, configOptions, HAUL_PLATFORM);

/**
 * Context is a communication way between webpack lifecycles and 
 * worker-parent channel
 */
const context = {
  fs: new MemoryFileSystem(),
  state: false,
  platform: HAUL_PLATFORM,
  webpackStats: null,
  callbacks: [],
  runLiveReload: () => {
    sendMessage(-1, EVENTS.liveReload);
  },
  compiler: null,
  onError: error => {
    // temp error handling
    console.log(`\nPlatform ${HAUL_PLATFORM} error\n${error.toString()}`);
  },
};

/**
 * Set compiler options, set fs to Memory
 */
context.compiler = webpack(config);
context.compiler.outputFileSystem = context.fs;

/**
 * Add plugin hooks to webpack, setup callbacks etc.
 */
const sharedContext = workerShared(context);

/**
 * Sends message to parent about error in message exchange
 */
const notifyParentMessageError = () => {
  sendMessage(
    -1,
    EVENTS.errorMessaging,
    `From fork ${HAUL_PLATFORM}: No ID or event received. | sendMessage`
  );
};

const receiveMessage = data => {
  if (data.ID === undefined || !data.event) {
    notifyParentMessageError();
    return;
  }
  const taskID = data.ID;

  switch (data.event) {
    case EVENTS.requestBuild: {
      sharedContext.handleRequest(HAUL_FILEOUTPUT, stats => {
        if (stats.hasErrors() || stats.hasWarnings()) {
          processBuildFailed(taskID, stats.compilation);
          return;
        }
        processBuildComplete(taskID);
      });
      break;
    }
    default:
      notifyParentMessageError();
  }
};

const sendMessage = (ID, event, payload) => {
  if (ID === undefined || !event) {
    notifyParentMessageError();
    return;
  }

  // Pipe the bundle to the parent
  if (event === EVENTS.buildFinished) {
    const fileReadStream = context.fs.createReadStream(payload);
    const conn = net.createConnection(HAUL_SOCKET);
    conn.setEncoding('utf-8');
    fileReadStream.pipe(conn);
  }

  process.send({
    platform: HAUL_PLATFORM,
    ID,
    event,
    payload,
  });
};

/**
 * Callback to `compiler.ready`, when webpack finishes bundle
 * @param {number} ID 
 */
const processBuildComplete = ID => {
  const filePath = path.join(process.cwd(), HAUL_FILEOUTPUT);
  sendMessage(ID, EVENTS.buildFinished, filePath);
};

const processBuildFailed = (ID, compilation) => {
  const errors = compilation.errors;
  const warnings = compilation.warnings;

  const message = {
    error: errors.toString(),
    warnings: warnings.toString(),
  };

  sendMessage(ID, EVENTS.buildFailed, message);
};

process.on('message', receiveMessage);
