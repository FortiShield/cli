import { existsSync } from 'fs';
import { isAbsolute, join } from 'path';
import { BuildscaleJsonConfiguration } from '../config/buildscale-json';
import { readJsonFile } from './fileutils';
import { workspaceRoot } from './workspace-root';

function readCacheDirectoryProperty(root: string): string | undefined {
  try {
    const buildscaleJson = readJsonFile<BuildscaleJsonConfiguration>(join(root, 'buildscale.json'));
    return (
      buildscaleJson.cacheDirectory ??
      buildscaleJson.tasksRunnerOptions?.default.options.cacheDirectory
    );
  } catch {
    return undefined;
  }
}

function absolutePath(root: string, path: string): string {
  if (isAbsolute(path)) {
    return path;
  } else {
    return join(root, path);
  }
}

function cacheDirectory(root: string, cacheDirectory: string) {
  const cacheDirFromEnv = process.env.BUILDSCALE_CACHE_DIRECTORY;
  if (cacheDirFromEnv) {
    cacheDirectory = cacheDirFromEnv;
  }
  if (cacheDirectory) {
    return absolutePath(root, cacheDirectory);
  } else {
    return defaultCacheDirectory(root);
  }
}

function defaultCacheDirectory(root: string) {
  // If buildscale.json doesn't exist the repo can't utilize
  // caching, so .buildscale/cache is less relevant. Lerna users
  // that don't want to fully opt in to Buildscale at this time
  // may also be caught off guard by the appearance of
  // a .buildscale directory, so we are going to special case
  // this for the time being.
  if (
    existsSync(join(root, 'lerna.json')) &&
    !existsSync(join(root, 'buildscale.json'))
  ) {
    return join(root, 'node_modules', '.cache', 'buildscale');
  }
  return join(root, '.buildscale', 'cache');
}

/**
 * Path to the directory where Buildscale stores its cache and daemon-related files.
 */
export const cacheDir = cacheDirectory(
  workspaceRoot,
  readCacheDirectoryProperty(workspaceRoot)
);

export function cacheDirectoryForWorkspace(workspaceRoot: string) {
  return cacheDirectory(
    workspaceRoot,
    readCacheDirectoryProperty(workspaceRoot)
  );
}

export const projectGraphCacheDirectory = absolutePath(
  workspaceRoot,
  process.env.BUILDSCALE_PROJECT_GRAPH_CACHE_DIRECTORY ??
    defaultCacheDirectory(workspaceRoot)
);
