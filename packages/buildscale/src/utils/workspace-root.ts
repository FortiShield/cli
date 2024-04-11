import * as path from 'path';
import { fileExists } from './fileutils';

/**
 * The root of the workspace
 */
export let workspaceRoot = workspaceRootInner(process.cwd(), process.cwd());

// Required for integration tests in projects which depend on Buildscale at runtime, such as lerna and angular-eslint
export function setWorkspaceRoot(root: string): void {
  workspaceRoot = root;
}

export function workspaceRootInner(
  dir: string,
  candidateRoot: string | null
): string {
  if (process.env.BUILDSCALE_WORKSPACE_ROOT_PATH)
    return process.env.BUILDSCALE_WORKSPACE_ROOT_PATH;
  if (path.dirname(dir) === dir) return candidateRoot;

  const matches = [
    path.join(dir, 'buildscale.json'),
    path.join(dir, 'buildscale'),
    path.join(dir, .buildscalew.bat'),
  ];

  if (matches.some((x) => fileExists(x))) {
    return dir;

    // This handles the case where we have a workspace which uses npm / yarn / pnpm
    // workspaces, and has a project which contains Buildscale in its dependency tree.
    // e.g. packages/my-lib/package.json contains @buildscale/devkit, which references Buildscale and is
    // thus located in //packages/my-lib/node_modules/buildscale/package.json
  } else if (fileExists(path.join(dir, 'node_modules', 'buildscale', 'package.json'))) {
    return workspaceRootInner(path.dirname(dir), dir);
  } else {
    return workspaceRootInner(path.dirname(dir), candidateRoot);
  }
}
