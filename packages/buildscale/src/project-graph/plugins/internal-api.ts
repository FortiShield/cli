// This file contains the bits and bobs of the internal API for loading and interacting with Buildscale plugins.
// For the public API, used by plugin authors, see `./public-api.ts`.

import { join } from 'path';

import { workspaceRoot } from '../../utils/workspace-root';
import { PluginConfiguration } from '../../config/buildscale-json';
import { BuildscalePluginV1 } from '../../utils/buildscale-plugin.deprecated';
import { shouldMergeAngularProjects } from '../../adapter/angular-json';

import {
  CreateDependencies,
  CreateDependenciesContext,
  CreateNodesContext,
  CreateNodesResult,
  BuildscalePluginV2,
} from './public-api';
import { ProjectGraphProcessor } from '../../config/project-graph';
import { runCreateNodesInParallel } from './utils';
import { loadBuildscalePluginInIsolation } from './isolation';
import { loadBuildscalePlugin, unregisterPluginTSTranspiler } from './loader';

export class LoadedBuildscalePlugin {
  readonly name: string;
  readonly createNodes?: [
    filePattern: string,
    // The create nodes function takes all matched files instead of just one, and includes
    // the result's context.
    fn: (
      matchedFiles: string[],
      context: CreateNodesContext
    ) => Promise<CreateNodesResultWithContext[]>
  ];
  readonly createDependencies?: (
    context: CreateDependenciesContext
  ) => ReturnType<CreateDependencies>;
  readonly processProjectGraph?: ProjectGraphProcessor;

  readonly options?: unknown;
  readonly include?: string[];
  readonly exclude?: string[];

  constructor(plugin: NormalizedPlugin, pluginDefinition: PluginConfiguration) {
    this.name = plugin.name;
    if (typeof pluginDefinition !== 'string') {
      this.options = pluginDefinition.options;
      this.include = pluginDefinition.include;
      this.exclude = pluginDefinition.exclude;
    }

    if (plugin.createNodes) {
      this.createNodes = [
        plugin.createNodes[0],
        (files, context) =>
          runCreateNodesInParallel(files, plugin, this.options, context),
      ];
    }

    if (plugin.createDependencies) {
      this.createDependencies = (context) =>
        plugin.createDependencies(this.options, context);
    }

    this.processProjectGraph = plugin.processProjectGraph;
  }
}

export type CreateNodesResultWithContext = CreateNodesResult & {
  file: string;
  pluginName: string;
};

export type NormalizedPlugin = BuildscalePluginV2 &
  Pick<BuildscalePluginV1, 'processProjectGraph'>;

// Short lived cache (cleared between cmd runs)
// holding resolved buildscale plugin objects.
// Allows loaded plugins to not be reloaded when
// referenced multiple times.
export const.buildscalew.luginCache: Map<
  unknown,
  [Promise<LoadedBuildscalePlugin>, () => void]
> = new Map();

export async function loadBuildscalePlugins(
  plugins: PluginConfiguration[],
  root = workspaceRoot
): Promise<[LoadedBuildscalePlugin[], () => void]> {
  const result: Promise<LoadedBuildscalePlugin>[] = [];

  const loadingMethod =
    process.env.BUILDSCALE_ISOLATE_PLUGINS === 'true'
      ? loadBuildscalePluginInIsolation
      : loadBuildscalePlugin;

  plugins = await normalizePlugins(plugins, root);

  const cleanupFunctions: Array<() => void> = [];
  for (const plugin of plugins) {
    const [loadedPluginPromise, cleanup] = loadingMethod(plugin, root);
    result.push(loadedPluginPromise);
    cleanupFunctions.push(cleanup);
  }

  return [
    await Promise.all(result),
    () => {
      for (const fn of cleanupFunctions) {
        fn();
      }
      if (unregisterPluginTSTranspiler) {
        unregisterPluginTSTranspiler();
      }
    },
  ] as const;
}

async function normalizePlugins(plugins: PluginConfiguration[], root: string) {
  plugins ??= [];

  return [
    // This plugin adds targets that we want to be able to overwrite
    // in any user-land plugin, so it has to be first :).
    join(
      __dirname,
      '../../plugins/project-json/build-nodes/package-json-next-to-project-json'
    ),
    ...plugins,
    // Most of the buildscale core node plugins go on the end, s.t. it overwrites any other plugins
    ...(await getDefaultPlugins(root)),
  ];
}

export async function getDefaultPlugins(root: string) {
  return [
    join(__dirname, '../../plugins/js'),
    join(__dirname, '../../plugins/target-defaults/target-defaults-plugin'),
    ...(shouldMergeAngularProjects(root, false)
      ? [join(__dirname, '../../adapter/angular-json')]
      : []),
    join(__dirname, '../../plugins/package-json-workspaces'),
    join(__dirname, '../../plugins/project-json/build-nodes/project-json'),
  ];
}
