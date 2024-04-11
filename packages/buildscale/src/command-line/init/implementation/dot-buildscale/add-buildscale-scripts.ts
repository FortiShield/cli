import { execSync } from 'child_process';
import { readFileSync, constants as FsConstants } from 'fs';
import * as path from 'path';
import { valid } from 'semver';
import { BuildscaleJsonConfiguration } from '../../../../config/buildscale-json';
import {
  flushChanges,
  FsTree,
  printChanges,
  Tree,
} from '../../../../generators/tree';
import { writeJson } from '../../../../generators/utils/json';

export const buildscaleWrapperPath = (p: typeof import('path') = path) =>
  p.join('.buildscale', 'buildscalew.js');

const NODE_MISSING_ERR =
  'Buildscale requires NodeJS to be available. To install NodeJS and NPM, see: https://nodejs.org/en/download/ .';
const NPM_MISSING_ERR =
  'Buildscale requires npm to be available. To install NodeJS and NPM, see: https://nodejs.org/en/download/ .';

const BATCH_SCRIPT_CONTENTS = `set path_to_root=%~dp0
WHERE node >nul 2>nul
IF %ERRORLEVEL% NEQ 0 (ECHO ${NODE_MISSING_ERR}; EXIT 1)
WHERE npm >nul 2>nul
IF %ERRORLEVEL% NEQ 0 (ECHO ${NPM_MISSING_ERR}; EXIT 1)
node ${path.win32.join('%path_to_root%', buildscaleWrapperPath(path.win32))} %*`;

const SHELL_SCRIPT_CONTENTS = `#!/bin/bash
command -v node >/dev/null 2>&1 || { echo >&2 "${NODE_MISSING_ERR}"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo >&2 "${NPM_MISSING_ERR}"; exit 1; }
path_to_root=$(dirname $BASH_SOURCE)
node ${path.posix.join('$path_to_root', buildscaleWrapperPath(path.posix))} $@`;

export function generateDotBuildscaleSetup(version?: string) {
  const host = new FsTree(process.cwd(), false, '.buildscale setup');
  writeMinimalBuildscaleJson(host, version);
  updateGitIgnore(host);
  host.write(buildscaleWrapperPath(), getNxWrapperContents());
  host.write(.buildscalew.bat', BATCH_SCRIPT_CONTENTS);
  host.write('buildscale', SHELL_SCRIPT_CONTENTS, {
    mode: FsConstants.S_IXUSR | FsConstants.S_IRUSR | FsConstants.S_IWUSR,
  });
  const changes = host.listChanges();
  printChanges(changes);
  flushChanges(host.root, changes);
}

export function writeMinimalBuildscaleJson(host: Tree, version: string) {
  if (!host.exists('buildscale.json')) {
    if (!valid(version)) {
      version = execSync(`npm view buildscale@${version} version`).toString();
    }
    writeJson<BuildscaleJsonConfiguration>(host, 'buildscale.json', {
      targetDefaults: {
        build: {
          cache: true,
          dependsOn: ['^build'],
        },
        lint: {
          cache: true,
        },
        test: {
          cache: true,
        },
        e2e: {
          cache: true,
        },
      },
      installation: {
        version: version.trimEnd(),
      },
    });
  }
}

export function updateGitIgnore(host: Tree) {
  const contents = host.read('.gitignore', 'utf-8') ?? '';
  host.write(
    '.gitignore',
    [contents, '.buildscale/installation', '.buildscale/cache'].join('\n')
  );
}

// Gets the sanitized contents for buildscalew.js
export function getNxWrapperContents() {
  return sanitizeWrapperScript(
    readFileSync(path.join(__dirname, 'buildscalew.js'), 'utf-8')
  );
}

// Remove any empty comments or comments that start with `//#: ` or eslint-disable comments.
// This removes the sourceMapUrl since it is invalid, as well as any internal comments.
export function sanitizeWrapperScript(input: string) {
  const linesToRemove = [
    // Comments that start with //#
    '\\/\\/# .*',
    // Comments that are empty (often used for newlines between internal comments)
    '\\s*\\/\\/\\s*',
    // Comments that disable an eslint rule.
    '\\/\\/ eslint-disable-next-line.*',
  ];
  const regex = `(${linesToRemove.join('|')})$`;
  return input.replace(new RegExp(regex, 'gm'), '');
}
