/**
 * Copyright 2017-present, Callstack.
 * All rights reserved.
 *
 * @flow
 */
import type { WebpackStats } from '../types';

const chalk = require('chalk');
const dedent = require('dedent');

const path = require('path');

const getBuildTime = webpackStats => {
  const stats = webpackStats.toJson({ timing: true });
  return stats.time
    ? stats.time
    : Math.max(...stats.children.map(({ time }) => time));
};

module.exports = ({
  stats,
  platform,
  assetsPath,
  bundlePath,
}: {
  stats: WebpackStats,
  platform: string,
  assetsPath?: string,
  bundlePath?: string,
}) => {
  const buildStats = stats.toJson({ timing: true });
  let heading = '';
  if (buildStats.time) {
    heading = buildStats.hasWarnings()
      ? chalk.yellow('Built with warnings')
      : `Built successfully in ${(buildStats.time / 1000).toFixed(2)}s!`;
  } else {
    heading += '\n';
    for (let i = 0; i < buildStats.children.length; i++) {
      heading += buildStats.children[i].warnings.length > 0
        ? chalk.yellow('Built with warnings\n')
        : `Built successfully in ${(buildStats.children[i].time / 1000).toFixed(2)}s!\n`;
    }
  }

  if (assetsPath && bundlePath) {
    return dedent`
      ${heading}

      Assets location: ${chalk.grey(assetsPath)}
      Bundle location: ${chalk.grey(path.join(assetsPath, bundlePath))}      
    `;
  }

  const device = platform === 'all' ? 'your device' : `your ${platform} device`;

  return dedent`
    ${heading}
    ${warnings.length ? `\n${warnings.join('\n\n')}\n` : ''}
    You can now run the app on ${device}\n
  `;
};
