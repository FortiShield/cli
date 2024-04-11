import { join } from 'node:path';

import {
  NrwlJsPluginConfig,
  BuildscaleJsonConfiguration,
} from '../../../config/buildscale-json';
import { fileExists, readJsonFile } from '../../../utils/fileutils';
import { PackageJson } from '../../../utils/package-json';
import { workspaceRoot } from '../../../utils/workspace-root';
import { existsSync } from 'fs';

export function jsPluginConfig(
  buildscaleJson: BuildscaleJsonConfiguration
): Required<NrwlJsPluginConfig> {
  const buildscaleJsonConfig: NrwlJsPluginConfig =
    buildscaleJson?.pluginsConfig?.['@buildscale/js'] ?? buildscaleJson?.pluginsConfig?.['@nrwl/js'];

  // using lerna _before_ installing deps is causing an issue when parsing lockfile.
  // See: https://github.com/lerna/lerna/issues/3807
  // Note that previous attempt to fix this caused issues with Buildscale itself, thus we're checking
  // for Lerna explicitly.
  // See: https://github.com/buildscale/cli/pull/18784/commits/5416138e1ddc1945d5b289672dfb468e8c544e14
  const analyzeLockfile =
    !existsSync(join(workspaceRoot, 'lerna.json')) ||
    existsSync(join(workspaceRoot, 'buildscale.json'));

  if (buildscaleJsonConfig) {
    return {
      analyzePackageJson: true,
      analyzeSourceFiles: true,
      analyzeLockfile,
      ...buildscaleJsonConfig,
    };
  }

  if (!fileExists(join(workspaceRoot, 'package.json'))) {
    return {
      analyzeLockfile: false,
      analyzePackageJson: false,
      analyzeSourceFiles: false,
    };
  }

  const packageJson = readJsonFile<PackageJson>(
    join(workspaceRoot, 'package.json')
  );

  const packageJsonDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };
  if (
    packageJsonDeps['@buildscale/workspace'] ||
    packageJsonDeps['@buildscale/js'] ||
    packageJsonDeps['@buildscale/node'] ||
    packageJsonDeps['@buildscale/next'] ||
    packageJsonDeps['@buildscale/react'] ||
    packageJsonDeps['@buildscale/angular'] ||
    packageJsonDeps['@buildscale/web'] ||
    packageJsonDeps['@nrwl/workspace'] ||
    packageJsonDeps['@nrwl/js'] ||
    packageJsonDeps['@nrwl/node'] ||
    packageJsonDeps['@nrwl/next'] ||
    packageJsonDeps['@nrwl/react'] ||
    packageJsonDeps['@nrwl/angular'] ||
    packageJsonDeps['@nrwl/web']
  ) {
    return {
      analyzePackageJson: true,
      analyzeLockfile,
      analyzeSourceFiles: true,
    };
  } else {
    return {
      analyzePackageJson: true,
      analyzeLockfile,
      analyzeSourceFiles: false,
    };
  }
}
