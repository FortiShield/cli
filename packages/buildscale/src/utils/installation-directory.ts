import { join } from 'path';
import { workspaceRoot } from './workspace-root';

export function getBuildscaleInstallationPath(root: string = workspaceRoot) {
  return join(root, '.buildscale', 'installation');
}

export function getBuildscaleRequirePaths(root: string = workspaceRoot) {
  return [root, getBuildscaleInstallationPath(root)];
}
