import { readBuildscaleJson } from '../../config/buildscale-json';
import {
  LoadedBuildscalePlugin,
  loadBuildscalePlugins,
} from '../../project-graph/plugins/internal-api';
import { workspaceRoot } from '../../utils/workspace-root';

let loadedPlugins: Promise<LoadedBuildscalePlugin[]>;
let cleanup: () => void;

export async function getPlugins() {
  if (loadedPlugins) {
    return loadedPlugins;
  }
  const pluginsConfiguration = readBuildscaleJson().plugins ?? [];
  const [result, cleanupFn] = await loadBuildscalePlugins(
    pluginsConfiguration,
    workspaceRoot
  );
  cleanup = cleanupFn;
  return result;
}

export function cleanupPlugins() {
  cleanup();
}
