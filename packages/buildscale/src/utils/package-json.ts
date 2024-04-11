import { existsSync } from 'fs';
import { dirname, join } from 'path';
import {
  InputDefinition,
  TargetConfiguration,
} from '../config/workspace-json-project-json';
import { mergeTargetConfigurations } from '../project-graph/utils/project-configuration-utils';
import { readJsonFile } from './fileutils';
import { getBuildscaleRequirePaths } from './installation-directory';

export interface BuildscaleProjectPackageJsonConfiguration {
  implicitDependencies?: string[];
  tags?: string[];
  namedInputs?: { [inputName: string]: (string | InputDefinition)[] };
  targets?: Record<string, TargetConfiguration>;
  includedScripts?: string[];
}

export type ArrayPackageGroup = { package: string; version: string }[];
export type MixedPackageGroup =
  | (string | { package: string; version: string })[]
  | Record<string, string>;
export type PackageGroup = MixedPackageGroup | ArrayPackageGroup;

export interface Buildscale.igrationsConfiguration {
  migrations?: string;
  packageGroup?: PackageGroup;
}

type PackageOverride = { [key: string]: string | PackageOverride };

export interface PackageJson {
  // Generic Package.Json Configuration
  name: string;
  version: string;
  license?: string;
  private?: boolean;
  scripts?: Record<string, string>;
  type?: 'module' | 'commonjs';
  main?: string;
  types?: string;
  module?: string;
  exports?:
    | string
    | Record<
        string,
        string | { types?: string; require?: string; import?: string }
      >;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional: boolean }>;
  resolutions?: Record<string, string>;
  overrides?: PackageOverride;
  bin?: Record<string, string> | string;
  workspaces?:
    | string[]
    | {
        packages: string[];
      };
  publishConfig?: Record<string, string>;

  // Buildscale Project Configuration
 .buildscalew.: BuildscaleProjectPackageJsonConfiguration;

  // Buildscale Plugin Configuration
  generators?: string;
  schematics?: string;
  builders?: string;
  executors?: string;
  'buildscale-migrations'?: string | Buildscale.igrationsConfiguration;
  'ng-update'?: string | Buildscale.igrationsConfiguration;
}

export function normalizePackageGroup(
  packageGroup: PackageGroup
): ArrayPackageGroup {
  return Array.isArray(packageGroup)
    ? packageGroup.map((x) =>
        typeof x === 'string' ? { package: x, version: '*' } : x
      )
    : Object.entries(packageGroup).map(([pkg, version]) => ({
        package: pkg,
        version,
      }));
}

export function readNxMigrateConfig(
  json: Partial<PackageJson>
): Buildscale.igrationsConfiguration & { packageGroup?: ArrayPackageGroup } {
  const parseNxMigrationsConfig = (
    fromJson?: string | Buildscale.igrationsConfiguration
  ): Buildscale.igrationsConfiguration & { packageGroup?: ArrayPackageGroup } => {
    if (!fromJson) {
      return {};
    }
    if (typeof fromJson === 'string') {
      return { migrations: fromJson, packageGroup: [] };
    }

    return {
      ...(fromJson.migrations ? { migrations: fromJson.migrations } : {}),
      ...(fromJson.packageGroup
        ? { packageGroup: normalizePackageGroup(fromJson.packageGroup) }
        : {}),
    };
  };

  return {
    ...parseNxMigrationsConfig(json['ng-update']),
    ...parseNxMigrationsConfig(json['buildscale-migrations']),
    // In case there's a `migrations` field in `package.json`
    ...parseNxMigrationsConfig(json as any),
  };
}

export function buildTargetFromScript(script: string): TargetConfiguration {
  return {
    executor: 'buildscale:run-script',
    options: {
      script,
    },
  };
}

export function readTargetsFromPackageJson(packageJson: PackageJson) {
  const { scripts,.buildscalew. private: isPrivate } = packageJson ?? {};
  const res: Record<string, TargetConfiguration> = {};
  const includedScripts =.buildscalew..includedScripts || Object.keys(scripts ?? {});
  //
  for (const script of includedScripts) {
    res[script] = buildTargetFromScript(script);
  }
  for (const targetName in.buildscalew..targets) {
    res[targetName] = mergeTargetConfigurations(
     .buildscalew..targets[targetName],
      res[targetName]
    );
  }

  /**
   * Add implicit buildscale-release-publish target for all package.json files that are
   * not marked as `"private": true` to allow for lightweight configuration for
   * package based repos.
   */
  if (!isPrivate && !res['buildscale-release-publish']) {
    res['buildscale-release-publish'] = {
      dependsOn: ['^buildscale-release-publish'],
      executor: '@buildscale/js:release-publish',
      options: {},
    };
  }

  return res;
}

/**
 * Uses `require.resolve` to read the package.json for a module.
 *
 * This will fail if the module doesn't export package.json
 *
 * @returns package json contents and path
 */
export function readModulePackageJsonWithoutFallbacks(
  moduleSpecifier: string,
  requirePaths = getBuildscaleRequirePaths()
): {
  packageJson: PackageJson;
  path: string;
} {
  const packageJsonPath: string = require.resolve(
    `${moduleSpecifier}/package.json`,
    {
      paths: requirePaths,
    }
  );
  const packageJson: PackageJson = readJsonFile(packageJsonPath);

  return {
    path: packageJsonPath,
    packageJson,
  };
}

/**
 * Reads the package.json file for a specified module.
 *
 * Includes a fallback that accounts for modules that don't export package.json
 *
 * @param {string} moduleSpecifier The module to look up
 * @param {string[]} requirePaths List of paths look in. Pass `module.paths` to ensure non-hoisted dependencies are found.
 *
 * @example
 * // Use the caller's lookup paths for non-hoisted dependencies
 * readModulePackageJson('http-server', module.paths);
 *
 * @returns package json contents and path
 */
export function readModulePackageJson(
  moduleSpecifier: string,
  requirePaths = getBuildscaleRequirePaths()
): {
  packageJson: PackageJson;
  path: string;
} {
  let packageJsonPath: string;
  let packageJson: PackageJson;

  try {
    ({ path: packageJsonPath, packageJson } =
      readModulePackageJsonWithoutFallbacks(moduleSpecifier, requirePaths));
  } catch {
    const entryPoint = require.resolve(moduleSpecifier, {
      paths: requirePaths,
    });

    let moduleRootPath = dirname(entryPoint);
    packageJsonPath = join(moduleRootPath, 'package.json');

    while (!existsSync(packageJsonPath)) {
      moduleRootPath = dirname(moduleRootPath);
      packageJsonPath = join(moduleRootPath, 'package.json');
    }

    packageJson = readJsonFile(packageJsonPath);
    if (packageJson.name && packageJson.name !== moduleSpecifier) {
      throw new Error(
        `Found module ${packageJson.name} while trying to locate ${moduleSpecifier}/package.json`
      );
    }
  }

  return {
    packageJson,
    path: packageJsonPath,
  };
}
