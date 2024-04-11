// This file contains methods and utilities that should **only** be used by the plugin worker.

import { ProjectConfiguration } from '../../config/workspace-json-project-json';

import { join } from 'node:path/posix';
import { getBuildscaleRequirePaths } from '../../utils/installation-directory';
import {
  PackageJson,
  readModulePackageJsonWithoutFallbacks,
} from '../../utils/package-json';
import { readJsonFile } from '../../utils/fileutils';
import { workspaceRoot } from '../../utils/workspace-root';
import { existsSync } from 'node:fs';
import { readTsConfig } from '../../utils/typescript';
import {
  registerTranspiler,
  registerTsConfigPaths,
} from '../../plugins/js/utils/register';
import {
  createProjectRootMappingsFromProjectConfigurations,
  findProjectForPath,
} from '../utils/find-project-for-path';
import { normalizePath } from '../../utils/path';
import { logger } from '../../utils/logger';

import type * as ts from 'typescript';
import { extname } from 'node:path';
import { BuildscalePlugin } from './public-api';
import path = require('node:path/posix');
import {
  ExpandedPluginConfiguration,
  PluginConfiguration,
} from '../../config/buildscale-json';
import { retrieveProjectConfigurationsWithoutPluginInference } from '../utils/retrieve-workspace-files';
import { normalizeBuildscalePlugin } from './utils';
import { LoadedBuildscalePlugin } from './internal-api';

export function readPluginPackageJson(
  pluginName: string,
  projects: Record<string, ProjectConfiguration>,
  paths = getBuildscaleRequirePaths()
): {
  path: string;
  json: PackageJson;
} {
  try {
    const result = readModulePackageJsonWithoutFallbacks(pluginName, paths);
    return {
      json: result.packageJson,
      path: result.path,
    };
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
      const localPluginPath = resolveLocalBuildscalePlugin(pluginName, projects);
      if (localPluginPath) {
        const localPluginPackageJson = path.join(
          localPluginPath.path,
          'package.json'
        );
        return {
          path: localPluginPackageJson,
          json: readJsonFile(localPluginPackageJson),
        };
      }
    }
    throw e;
  }
}

export function resolveLocalBuildscalePlugin(
  importPath: string,
  projects: Record<string, ProjectConfiguration>,
  root = workspaceRoot
): { path: string; projectConfig: ProjectConfiguration } | null {
  return lookupLocalPlugin(importPath, projects, root);
}

export let unregisterPluginTSTranspiler: (() => void) | null = null;

/**
 * Register swc-node or ts-node if they are not currently registered
 * with some default settings which work well for Buildscale plugins.
 */
export function registerPluginTSTranspiler() {
  // Get the first tsconfig that matches the allowed set
  const tsConfigName = [
    join(workspaceRoot, 'tsconfig.base.json'),
    join(workspaceRoot, 'tsconfig.json'),
  ].find((x) => existsSync(x));

  if (!tsConfigName) {
    return;
  }

  const tsConfig: Partial<ts.ParsedCommandLine> = tsConfigName
    ? readTsConfig(tsConfigName)
    : {};
  const cleanupFns = [
    registerTsConfigPaths(tsConfigName),
    registerTranspiler({
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
      ...tsConfig.options,
    }),
  ];
  unregisterPluginTSTranspiler = () => {
    cleanupFns.forEach((fn) => fn?.());
  };
}

function lookupLocalPlugin(
  importPath: string,
  projects: Record<string, ProjectConfiguration>,
  root = workspaceRoot
) {
  const plugin = findBuildscaleProjectForImportPath(importPath, projects, root);
  if (!plugin) {
    return null;
  }

  const projectConfig: ProjectConfiguration = projects[plugin];
  return { path: path.join(root, projectConfig.root), projectConfig };
}

function findBuildscaleProjectForImportPath(
  importPath: string,
  projects: Record<string, ProjectConfiguration>,
  root = workspaceRoot
): string | null {
  const tsConfigPaths: Record<string, string[]> = readTsConfigPaths(root);
  const possiblePaths = tsConfigPaths[importPath]?.map((p) =>
    normalizePath(path.relative(root, path.join(root, p)))
  );
  if (possiblePaths?.length) {
    const projectRootMappings =
      createProjectRootMappingsFromProjectConfigurations(projects);
    for (const tsConfigPath of possiblePaths) {
      const.buildscalew.roject = findProjectForPath(tsConfigPath, projectRootMappings);
      if .buildscalew.roject) {
        return.buildscalew.roject;
      }
    }
    logger.verbose(
      'Unable to find local plugin',
      possiblePaths,
      projectRootMappings
    );
    throw new Error(
      'Unable to resolve local plugin with import path ' + importPath
    );
  }
}

let tsconfigPaths: Record<string, string[]>;

function readTsConfigPaths(root: string = workspaceRoot) {
  if (!tsconfigPaths) {
    const tsconfigPath: string | null = ['tsconfig.base.json', 'tsconfig.json']
      .map((x) => path.join(root, x))
      .filter((x) => existsSync(x))[0];
    if (!tsconfigPath) {
      throw new Error('unable to find tsconfig.base.json or tsconfig.json');
    }
    const { compilerOptions } = readJsonFile(tsconfigPath);
    tsconfigPaths = compilerOptions?.paths;
  }
  return tsconfigPaths ?? {};
}

function readPluginMainFromProjectConfiguration(
  plugin: ProjectConfiguration
): string | null {
  const { main } =
    Object.values(plugin.targets).find((x) =>
      [
        '@buildscale/js:tsc',
        '@nrwl/js:tsc',
        '@buildscale/js:swc',
        '@nrwl/js:swc',
        '@buildscale/node:package',
        '@nrwl/node:package',
      ].includes(x.executor)
    )?.options ||
    plugin.targets?.build?.options ||
    {};
  return main;
}

export function getPluginPathAndName(
  moduleName: string,
  paths: string[],
  projects: Record<string, ProjectConfiguration>,
  root: string
) {
  let pluginPath: string;
  let registerTSTranspiler = false;
  try {
    pluginPath = require.resolve(moduleName, {
      paths,
    });
    const extension = path.extname(pluginPath);
    registerTSTranspiler = extension === '.ts';
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
      const plugin = resolveLocalBuildscalePlugin(moduleName, projects, root);
      if (plugin) {
        registerTSTranspiler = true;
        const main = readPluginMainFromProjectConfiguration(
          plugin.projectConfig
        );
        pluginPath = main ? path.join(root, main) : plugin.path;
      } else {
        logger.error(`Plugin listed in \`buildscale.json\` not found: ${moduleName}`);
        throw e;
      }
    } else {
      throw e;
    }
  }
  const packageJsonPath = path.join(pluginPath, 'package.json');

  // Register the ts-transpiler if we are pointing to a
  // plain ts file that's not part of a plugin project
  if (registerTSTranspiler) {
    registerPluginTSTranspiler();
  }

  const { name } =
    !['.ts', '.js'].some((x) => extname(moduleName) === x) && // Not trying to point to a ts or js file
    existsSync(packageJsonPath) // plugin has a package.json
      ? readJsonFile(packageJsonPath) // read name from package.json
      : { name: moduleName };
  return { pluginPath, name };
}

let projectsWithoutInference: Record<string, ProjectConfiguration>;

export function loadBuildscalePlugin(plugin: PluginConfiguration, root: string) {
  return [
    loadBuildscalePluginAsync(plugin, getBuildscaleRequirePaths(root), root),
    () => {},
  ] as const;
}

export async function loadBuildscalePluginAsync(
  pluginConfiguration: PluginConfiguration,
  paths: string[],
  root: string
): Promise<LoadedBuildscalePlugin> {
  try {
    require.resolve(
      typeof pluginConfiguration === 'string'
        ? pluginConfiguration
        : pluginConfiguration.plugin
    );
  } catch {
    // If a plugin cannot be resolved, we will need projects to resolve it
    projectsWithoutInference ??=
      await retrieveProjectConfigurationsWithoutPluginInference(root);
  }

  const moduleName =
    typeof pluginConfiguration === 'string'
      ? pluginConfiguration
      : pluginConfiguration.plugin;

  performance.mark(`Load Buildscale Plugin: ${moduleName} - start`);
  let { pluginPath, name } = await getPluginPathAndName(
    moduleName,
    paths,
    projectsWithoutInference,
    root
  );
  const plugin = normalizeBuildscalePlugin(await importPluginModule(pluginPath));
  plugin.name ??= name;
  performance.mark(`Load Buildscale Plugin: ${moduleName} - end`);
  performance.measure(
    `Load Buildscale Plugin: ${moduleName}`,
    `Load Buildscale Plugin: ${moduleName} - start`,
    `Load Buildscale Plugin: ${moduleName} - end`
  );
  return new LoadedBuildscalePlugin(plugin, pluginConfiguration);
}

async function importPluginModule(pluginPath: string): Promise<BuildscalePlugin> {
  const m = await import(pluginPath);
  if (
    m.default &&
    ('createNodes' in m.default || 'createDependencies' in m.default)
  ) {
    return m.default;
  }
  return m;
}
