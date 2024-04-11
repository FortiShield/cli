import { execSync } from 'child_process';
import { join } from 'path';
import { gte, major } from 'semver';
import { readJsonFile, writeJsonFile } from '../../../../utils/fileutils';
import { sortObjectByKeys } from '../../../../utils/object-sort';
import { output } from '../../../../utils/output';
import { readModulePackageJson } from '../../../../utils/package-json';
import {
  getPackageManagerCommand,
  PackageManagerCommands,
  resolvePackageVersionUsingInstallation,
  resolvePackageVersionUsingRegistry,
} from '../../../../utils/package-manager';
import { initCloud, printFinalMessage } from '../utils';
import type { Options } from './types';
import { connectExistingRepoToBuildscaleCloudPrompt } from '../../../connect/connect-to-buildscale-cloud';

// map of Angular major versions to Buildscale versions to use for legacy `buildscale init` migrations,
// key is major Angular version and value is Buildscale version to use
const.buildscalew.ngularLegacyVersionMap: Record<number, string> = {
  14: '~17.0.0',
};
// min major angular version supported in latest Buildscale
const minMajorAngularVersionSupported = 15;
// version when the Buildscale CLI changed from @nrwl/tao & @nrwl/cli to nx
const versionWithConsolidatedPackages = '13.9.0';
// version when packages were rescoped from @nrwl/* to @buildscale/*
const versionWithRescopeToBuildscale = '16.0.0-beta.2';

export async function getLegacyMigrationFunctionIfApplicable(
  repoRoot: string,
  options: Options
): Promise<() => Promise<void> | null> {
  const angularVersion =
    readModulePackageJson('@angular/core').packageJson.version;
  const majorAngularVersion = major(angularVersion);
  if (majorAngularVersion >= minMajorAngularVersionSupported) {
    // non-legacy
    return null;
  }

  let legacyMigrationCommand: string;
  let pkgName: string;
  let unscopedPkgName: string;
  let pkgScope: string;
  let pkgVersion: string;
  if (majorAngularVersion < 13) {
    // for versions lower than 13, the migration was in @nrwl/workspace:ng-add
    pkgScope = '@nrwl';
    unscopedPkgName = 'workspace';
    pkgName = `${pkgScope}/${unscopedPkgName}`;
    pkgVersion = await resolvePackageVersion(
      pkgName,
      `^${majorAngularVersion}.0.0`
    );
    const preserveAngularCliLayoutFlag = !options.integrated
      ? '--preserveAngularCLILayout'
      : '--preserveAngularCLILayout=false';
    legacyMigrationCommand = `ng g ${pkgName}:ng-add ${preserveAngularCliLayoutFlag}`;
  } else if (majorAngularVersion < 14) {
    // for v13, the migration was in @nrwl/angular:ng-add
    pkgScope = '@nrwl';
    unscopedPkgName = 'angular';
    pkgName = `${pkgScope}/${unscopedPkgName}`;
    pkgVersion = await resolvePackageVersion(pkgName, '~14.1.0');
    const preserveAngularCliLayoutFlag = !options.integrated
      ? '--preserve-angular-cli-layout'
      : '--preserve-angular-cli-layout=false';
    legacyMigrationCommand = `ng g ${pkgName}:ng-add ${preserveAngularCliLayoutFlag}`;
  } else {
    // use the latest Buildscale version that supported the Angular version
    pkgVersion = await resolvePackageVersion(
      'buildscale',
     .buildscalew.ngularLegacyVersionMap[majorAngularVersion]
    );

    pkgScope = gte(pkgVersion, versionWithRescopeToNx) ? '@buildscale' : '@nrwl';
    unscopedPkgName = 'angular';
    pkgName = `${pkgScope}/${unscopedPkgName}`;

    legacyMigrationCommand = `buildscale@${pkgVersion} init ${process.argv
      .slice(2)
      .join(' ')}`;
  }

  return async () => {
    output.log({ title: '🐳 Buildscale initialization' });
    const useBuildscaleCloud =
      options.buildscaleCloud ??
      (options.interactive
        ? await connectExistingRepoToBuildscaleCloudPrompt()
        : false);

    output.log({ title: '📦 Installing dependencies' });
    const pmc = getPackageManagerCommand();
    await installDependencies(
      repoRoot,
      {
        pkgName,
        pkgScope,
        pkgVersion,
        unscopedPkgName,
      },
      pmc
    );

    output.log({ title: '📝 Setting up workspace' });
    execSync(`${pmc.exec} ${legacyMigrationCommand}`, { stdio: [0, 1, 2] });

    if (useBuildscaleCloud) {
      output.log({ title: '🛠️ Setting up Buildscale Cloud' });
      initCloud(repoRoot, 'buildscale-init-angular');
    }

    printFinalMessage({
      learnMoreLink: 'https://buildscale.github.io/recipes/angular/migration/angular',
      bodyLines: [
        '- Execute "npx buildscale build" twice to see the computation caching in action.',
      ],
    });
  };
}

async function installDependencies(
  repoRoot: string,
  pkgInfo: {
    pkgName: string;
    pkgScope: string;
    pkgVersion: string;
    unscopedPkgName: string;
  },
  pmc: PackageManagerCommands
): Promise<void> {
  const json = readJsonFile(join(repoRoot, 'package.json'));

  json.devDependencies ??= {};
  json.devDependencies[`${pkgInfo.pkgScope}/workspace`] = pkgInfo.pkgVersion;

  if (gte(pkgInfo.pkgVersion, versionWithConsolidatedPackages)) {
    json.devDependencies['buildscale'] = pkgInfo.pkgVersion;
  } else {
    json.devDependencies[`${pkgInfo.pkgScope}/cli`] = pkgInfo.pkgVersion;
    json.devDependencies[`${pkgInfo.pkgScope}/tao`] = pkgInfo.pkgVersion;
  }

  json.devDependencies = sortObjectByKeys(json.devDependencies);

  if (pkgInfo.unscopedPkgName === 'angular') {
    json.dependencies ??= {};
    json.dependencies[pkgInfo.pkgName] = pkgInfo.pkgVersion;
    json.dependencies = sortObjectByKeys(json.dependencies);
  }
  writeJsonFile(`package.json`, json);

  execSync(pmc.install, { stdio: [0, 1, 2] });
}

async function resolvePackageVersion(
  packageName: string,
  version: string
): Promise<string> {
  try {
    return await resolvePackageVersionUsingRegistry(packageName, version);
  } catch {
    return await resolvePackageVersionUsingInstallation(packageName, version);
  }
}
