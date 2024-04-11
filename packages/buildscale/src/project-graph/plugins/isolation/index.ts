import { workspaceRoot } from '../../../utils/workspace-root';
import { PluginConfiguration } from '../../../config/buildscale-json';
import { LoadedBuildscalePlugin } from '../internal-api';
import { loadRemoteBuildscalePlugin } from './plugin-pool';

const remotePluginCache = new Map<
  string,
  [Promise<LoadedBuildscalePlugin>, () => void]
>();

export function loadBuildscalePluginInIsolation(
  plugin: PluginConfiguration,
  root = workspaceRoot
): [Promise<LoadedBuildscalePlugin>, () => void] {
  const cacheKey = JSON.stringify(plugin);

  if (remotePluginCache.has(cacheKey)) {
    return remotePluginCache.get(cacheKey);
  }

  const [loadingPlugin, cleanup] = loadRemoteBuildscalePlugin(plugin, root);
  remotePluginCache.set(cacheKey, [loadingPlugin, cleanup]);
  return [loadingPlugin, cleanup];
}
