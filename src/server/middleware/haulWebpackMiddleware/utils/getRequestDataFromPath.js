/**
 * Copyright 2017-present, Callstack.
 * All rights reserved.
 * 
 * @flow
 */

module.exports = function getRequestDataFromPath(path: string) {
  const fileRegExp = /\w+\.(ios|android)\.bundle/i;

  const match = path.match(fileRegExp);
  if (match) {
    return {
      filename: match[0],
      platform: match[1],
    };
  }

  return {};
};
