import * as chalk from 'chalk';
import { output } from '../output';
import type { PluginCapabilities } from './models';
import { getPluginCapabilities } from './plugin-capabilities';
import { hasElements } from './shared';
import { readJsonFile } from '../fileutils';
import { PackageJson, readModulePackageJson } from '../package-json';
import { workspaceRoot } from '../workspace-root';
import { join } from 'path';
import { readBuildscaleJson } from '../../config/buildscale-json';
import { getBuildscaleRequirePaths } from '../installation-directory';
import { ProjectConfiguration } from '../../config/workspace-json-project-json';

export function findInstalledPlugins(): PackageJson[] {
  const packageJsonDeps = getDependenciesFromPackageJson();
  const buildscaleJsonDeps = getDependenciesFromBuildscaleJson();
  const deps = packageJsonDeps.concat(buildscaleJsonDeps);
  const result: PackageJson[] = [];
  for (const dep of deps) {
    const pluginPackageJson = getBuildscalePluginPackageJsonOrNull(dep);
    if (pluginPackageJson) {
      result.push(pluginPackageJson);
    }
  }
  return result.sort((a, b) => a.name.localeCompare(b.name));
}

function getBuildscalePluginPackageJsonOrNull(pkg: string): PackageJson | null {
  try {
    const { packageJson } = readModulePackageJson(pkg, getBuildscaleRequirePaths());
    return packageJson &&
      [
        'ng-update',
        'buildscale-migrations',
        'schematics',
        'generators',
        'builders',
        'executors',
      ].some((field) => field in packageJson)
      ? packageJson
      : null;
  } catch {
    return null;
  }
}

function getDependenciesFromPackageJson(
  packageJsonPath = 'package.json'
): string[] {
  try {
    const { dependencies, devDependencies } = readJsonFile(
      join(workspaceRoot, packageJsonPath)
    );
    return Object.keys({ ...dependencies, ...devDependencies });
  } catch {}
  return [];
}

function getDependenciesFromBuildscaleJson(): string[] {
  const { installation } = readBuildscaleJson();
  if (!installation) {
    return [];
  }
  return ['buildscale', ...Object.keys(installation.plugins || {})];
}

export async function getInstalledPluginsAndCapabilities(
  workspaceRoot: string,
  projects: Record<string, ProjectConfiguration>
): Promise<Map<string, PluginCapabilities>> {
  const plugins = findInstalledPlugins().map((p) => p.name);

  const result = new Map<string, PluginCapabilities>();
  for (const plugin of Array.from(plugins).sort()) {
    try {
      const capabilities = await getPluginCapabilities(
        workspaceRoot,
        plugin,
        projects
      );
      if (
        capabilities &&
        (capabilities.executors ||
          capabilities.generators ||
          capabilities.projectGraphExtension ||
          capabilities.projectInference)
      ) {
        result.set(plugin, capabilities);
      }
    } catch {}
  }

  return result;
}

export function listInstalledPlugins(
  installedPlugins: Map<string, PluginCapabilities>
) {
  const bodyLines: string[] = [];

  for (const [, p] of installedPlugins) {
    const capabilities = [];
    if (hasElements(p.executors)) {
      capabilities.push('executors');
    }
    if (hasElements(p.generators)) {
      capabilities.push('generators');
    }
    if (p.projectGraphExtension) {
      capabilities.push('graph-extensions');
    }
    if (p.projectInference) {
      capabilities.push('project-inference');
    }
    bodyLines.push(`${chalk.bold(p.name)} (${capabilities.join()})`);
  }

  output.log({
    title: `Installed plugins:`,
    bodyLines: bodyLines,
  });
}
