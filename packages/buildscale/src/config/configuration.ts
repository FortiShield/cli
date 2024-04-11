import { readBuildscaleJson } from './buildscale-json';

/**
 * Returns information about where apps and libs will be created.
 */
export function workspaceLayout(): { appsDir: string; libsDir: string } {
  const buildscaleJson = readBuildscaleJson();
  return {
    appsDir: buildscaleJson.workspaceLayout?.appsDir ?? 'apps',
    libsDir: buildscaleJson.workspaceLayout?.libsDir ?? 'libs',
  };
}

export { readBuildscaleJson } from './buildscale-json';
