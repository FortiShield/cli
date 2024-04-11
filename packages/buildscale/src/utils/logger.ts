import * as chalk from 'chalk';

export const BUILDSCALE_PREFIX = chalk.inverse(chalk.bold(chalk.cyan(' BUILDSCALE ')));

export const BUILDSCALE_ERROR = chalk.inverse(chalk.bold(chalk.red(' ERROR ')));

export const logger = {
  warn: (s) => console.warn(chalk.bold(chalk.yellow(s))),
  error: (s) => {
    if (typeof s === 'string' && s.startsWith('BUILDSCALE ')) {
      console.error(`\n${BUILDSCALE_ERROR} ${chalk.bold(chalk.red(s.slice(3)))}\n`);
    } else if (s instanceof Error && s.stack) {
      console.error(chalk.bold(chalk.red(s.stack)));
    } else {
      console.error(chalk.bold(chalk.red(s)));
    }
  },
  info: (s) => {
    if (typeof s === 'string' && s.startsWith('BUILDSCALE ')) {
      console.info(`\n${BUILDSCALE_PREFIX} ${chalk.bold(s.slice(3))}\n`);
    } else {
      console.info(s);
    }
  },
  log: (...s) => {
    console.log(...s);
  },
  debug: (...s) => {
    console.debug(...s);
  },
  fatal: (...s) => {
    console.error(...s);
  },
  verbose: (...s) => {
    if (process.env.BUILDSCALE_VERBOSE_LOGGING) {
      console.log(...s);
    }
  },
};

export function stripIndent(str: string): string {
  const match = str.match(/^[ \t]*(?=\S)/gm);
  if (!match) {
    return str;
  }
  const indent = match.reduce((r, a) => Math.min(r, a.length), Infinity);
  const regex = new RegExp(`^[ \\t]{${indent}}`, 'gm');
  return str.replace(regex, '');
}