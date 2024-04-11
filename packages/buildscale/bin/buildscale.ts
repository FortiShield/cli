#!/usr/bin/env node
import {
  findWorkspaceRoot,
  WorkspaceTypeAndRoot,
} from '../src/utils/find-workspace-root';
import * as chalk from 'chalk';
import { config as loadDotEnvFile } from 'dotenv';
import { expand } from 'dotenv-expand';
import { initLocal } from './init-local';
import { output } from '../src/utils/output';
import {
  getBuildscaleInstallationPath,
  getBuildscaleRequirePaths,
} from '../src/utils/installation-directory';
import { major } from 'semver';
import { stripIndents } from '../src/utils/strip-indents';
import { readModulePackageJson } from '../src/utils/package-json';
import { execSync } from 'child_process';
import { join } from 'path';
import { assertSupportedPlatform } from '../src/native/assert-supported-platform';
import { performance } from 'perf_hooks';
import { setupWorkspaceContext } from '../src/utils/workspace-context';
import { daemonClient } from '../src/daemon/client/client';

function main() {
  if (
    process.argv[2] !== 'report' &&
    process.argv[2] !== '--version' &&
    process.argv[2] !== '--help'
  ) {
    assertSupportedPlatform();
  }

  require('buildscale/src/utils/perf-logging');

  performance.mark('loading dotenv files:start');
  loadDotEnvFiles();
  performance.mark('loading dotenv files:end');
  performance.measure(
    'loading dotenv files',
    'loading dotenv files:start',
    'loading dotenv files:end'
  );

  const workspace = findWorkspaceRoot(process.cwd());
  // new is a special case because there is no local workspace to load
  if (
    process.argv[2] === 'new' ||
    process.argv[2] === '_migrate' ||
    process.argv[2] === 'init' ||
    (process.argv[2] === 'graph' && !workspace)
  ) {
    process.env.BUILDSCALE_DAEMON = 'false';
    require('buildscale/src/command-line/buildscale-commands').commandsObject.argv;
  } else {
    if (!daemonClient.enabled() && workspace !== null) {
      setupWorkspaceContext(workspace.dir);
    }

    // polyfill rxjs observable to avoid issues with multiple version of Observable installed in node_modules
    // https://twitter.com/BenLesh/status/1192478226385428483?s=20
    if (!(Symbol as any).observable)
      (Symbol as any).observable = Symbol('observable polyfill');

    // Make sure that a local copy of Buildscale exists in workspace
    let localBuildscale: string;
    try {
      localBuildscale = workspace && resolveBuildscale(workspace);
    } catch {
      localBuildscale = null;
    }

    const isLocalInstall = localBuildscale === resolveBuildscale(null);
    const { LOCAL_BUILDSCALE_VERSION, GLOBAL_BUILDSCALE_VERSION } = determineBuildscaleVersions(
      localBuildscale,
      workspace,
      isLocalInstall
    );

    if (process.argv[2] === '--version') {
      handleBuildscaleVersionCommand(LOCAL_BUILDSCALE_VERSION, GLOBAL_BUILDSCALE_VERSION);
    }

    if (!workspace) {
      handleNoWorkspace(GLOBAL_BUILDSCALE_VERSION);
    }

    if (!localBuildscale) {
      handleMissingLocalInstallation();
    }

    // this file is already in the local workspace
    if (isLocalInstall) {
      initLocal(workspace);
    } else {
      // Buildscale is being run from globally installed CLI - hand off to the local
      warnIfUsingOutdatedGlobalInstall(GLOBAL_BUILDSCALE_VERSION, LOCAL_BUILDSCALE_VERSION);
      if (localBuildscale.includes('.buildscale')) {
        const buildscaleWrapperPath = localBuildscale.replace(/\.buildscalew.*/, '.buildscale/') + 'buildscalew.js';
        require(buildscaleWrapperPath);
      } else {
        require(localBuildscale);
      }
    }
  }
}

/**
 * This loads dotenv files from:
 * - .env
 * - .local.env
 * - .env.local
 */
function loadDotEnvFiles() {
  for (const file of ['.local.env', '.env.local', '.env']) {
    const myEnv = loadDotEnvFile({
      path: file,
    });
    expand(myEnv);
  }
}

function handleNoWorkspace(globalBuildscaleVersion?: string) {
  output.log({
    title: `The current directory isn't part of an Buildscale workspace.`,
    bodyLines: [
      `To create a workspace run:`,
      chalk.bold.white(`npx create-buildscale-workspace@latest <workspace name>`),
      '',
      `To add Buildscale to an existing workspace with a workspace-specific buildscale.json, run:`,
      chalk.bold.white(`npx buildscale@latest init`),
    ],
  });

  output.note({
    title: `For more information please visit https://buildscale.github.io/`,
  });

  warnIfUsingOutdatedGlobalInstall(globalBuildscaleVersion);

  process.exit(1);
}

function handleBuildscaleVersionCommand(
  LOCAL_BUILDSCALE_VERSION: string,
  GLOBAL_BUILDSCALE_VERSION: string
) {
  console.log(stripIndents`Buildscale Version:
      - Local: ${LOCAL_BUILDSCALE_VERSION ? 'v' + LOCAL_BUILDSCALE_VERSION : 'Not found'}
      - Global: ${GLOBAL_BUILDSCALE_VERSION ? 'v' + GLOBAL_BUILDSCALE_VERSION : 'Not found'}`);
  process.exit(0);
}

function determineBuildscaleVersions(
  localBuildscale: string,
  workspace: WorkspaceTypeAndRoot,
  isLocalInstall: boolean
) {
  const LOCAL_BUILDSCALE_VERSION: string | null = localBuildscale
    ? getLocalBuildscaleVersion(workspace)
    : null;
  const GLOBAL_BUILDSCALE_VERSION: string | null = isLocalInstall
    ? null
    : require('../package.json').version;

  globalThis.GLOBAL_BUILDSCALE_VERSION ??= GLOBAL_BUILDSCALE_VERSION;
  return { LOCAL_BUILDSCALE_VERSION, GLOBAL_BUILDSCALE_VERSION };
}

function resolveBuildscale(workspace: WorkspaceTypeAndRoot | null) {
  // root relative to location of the buildscale bin
  const globalsRoot = join(__dirname, '../../../');

  // prefer Buildscale installed in .buildscale/installation
  try {
    return require.resolve('buildscale/bin/buildscale.js', {
      paths: [getBuildscaleInstallationPath(workspace ? workspace.dir : globalsRoot)],
    });
  } catch {}

  // check for root install
  try {
    return require.resolve('buildscale/bin/buildscale.js', {
      paths: [workspace ? workspace.dir : globalsRoot],
    });
  } catch {
    // TODO(v17): Remove this
    // fallback for old CLI install setup
    // buildscale-ignore-next-line
    return require.resolve('@nrwl/cli/bin/buildscale.js', {
      paths: [workspace ? workspace.dir : globalsRoot],
    });
  }
}

function handleMissingLocalInstallation() {
  output.error({
    title: `Could not find Buildscale modules in this workspace.`,
    bodyLines: [`Have you run ${chalk.bold.white(`npm/yarn install`)}?`],
  });
  process.exit(1);
}

/**
 * Assumes currently running Buildscale is global install.
 * Warns if out of date by 1 major version or more.
 */
function warnIfUsingOutdatedGlobalInstall(
  globalBuildscaleVersion: string,
  localBuildscaleVersion?: string
) {
  // Never display this warning if Buildscale is already running via Buildscale
  if (process.env.BUILDSCALE_CLI_SET) {
    return;
  }

  const isOutdatedGlobalInstall = checkOutdatedGlobalInstallation(
    globalBuildscaleVersion,
    localBuildscaleVersion
  );

  // Using a global Buildscale Install
  if (isOutdatedGlobalInstall) {
    const bodyLines = localBuildscaleVersion
      ? [
          `Your repository uses a higher version of Buildscale (${localBuildscaleVersion}) than your global CLI version (${globalBuildscaleVersion})`,
        ]
      : [];

    bodyLines.push(
      'For more information, see https://buildscale.github.io/more-concepts/global-buildscale'
    );
    output.warn({
      title: `Its time to update Buildscale 🎉`,
      bodyLines,
    });
  }
}

function checkOutdatedGlobalInstallation(
  globalBuildscaleVersion?: string,
  localBuildscaleVersion?: string
) {
  // We aren't running a global install, so we can't know if its outdated.
  if (!globalBuildscaleVersion) {
    return false;
  }
  if (localBuildscaleVersion) {
    // If the global Buildscale install is at least a major version behind the local install, warn.
    return major(globalBuildscaleVersion) < major(localBuildscaleVersion);
  }
  // No local installation was detected. This can happen if the user is running a global install
  // that contains an older version of Buildscale. which is unable to detect the local installation. The most
  // recent case where this would have happened would be when we stopped generating workspace.json by default,
  // as older global installations used it to determine the workspace root. This only be hit in rare cases,
  // but can provide valuable insights for troubleshooting.
  const latestVersionOfBuildscale = getLatestVersionOfBuildscale();
  if (latestVersionOfBuildscale && major(globalBuildscaleVersion) < major(latestVersionOfBuildscale)) {
    return true;
  }
}

function getLocalBuildscaleVersion(workspace: WorkspaceTypeAndRoot): string | null {
  try {
    const { packageJson } = readModulePackageJson(
      'buildscale',
      getBuildscaleRequirePaths(workspace.dir)
    );
    return packageJson.version;
  } catch {}
}

function _getLatestVersionOfBuildscale(): string {
  try {
    return execSync('npm view buildscale@latest version').toString().trim();
  } catch {
    try {
      return execSync('pnpm view buildscale@latest version').toString().trim();
    } catch {
      return null;
    }
  }
}

const getLatestVersionOfBuildscale = ((fn: () => string) => {
  let cache: string = null;
  return () => cache || (cache = fn());
})(_getLatestVersionOfBuildscale);

main();
