import { execSync } from 'child_process';
import { prompt } from 'enquirer';
import { existsSync } from 'fs';
import { prerelease } from 'semver';
import { addBuildscaleToMonorepo } from './implementation/add-buildscale-to-monorepo';
import { addBuildscaleToNest } from './implementation/add-buildscale-to-nest';
import { addBuildscaleToNpmRepo } from './implementation/add-buildscale-to-npm-repo';
import { addBuildscaleToAngularCliRepo } from './implementation/angular';
import { generateDotBuildscaleSetup } from './implementation/dot-buildscale/add-buildscale-scripts';
import { addBuildscaleToCraRepo } from './implementation/react';
import { runBuildscaleSync } from '../../utils/child-process';
import { directoryExists, readJsonFile } from '../../utils/fileutils';
import { PackageJson } from '../../utils/package-json';
import { buildscaleVersion } from '../../utils/versions';
import { isMonorepo } from './implementation/utils';

export interface InitArgs {
  addE2e: boolean;
  force: boolean;
  integrated: boolean;
  interactive: boolean;
  vite: boolean;
  buildscaleCloud?: boolean;
  cacheable?: string[];
  useDotBuildscaleInstallation?: boolean;
}

export async function initHandler(options: InitArgs) {
  // strip the 'init' command itself so we don't forward it
  const args = process.argv.slice(3).join(' ');

  const version =
    process.env.BUILDSCALE_VERSION ?? (prerelease(buildscaleVersion) ? 'next' : 'latest');
  if (process.env.BUILDSCALE_VERSION) {
    console.log(`Using version ${process.env.BUILDSCALE_VERSION}`);
  }
  if (options.useDotBuildscaleInstallation === true) {
    setupDotBuildscaleInstallation(version);
  } else if (existsSync('package.json')) {
    const packageJson: PackageJson = readJsonFile('package.json');
    if (existsSync('angular.json')) {
      await addBuildscaleToAngularCliRepo(options);
    } else if (isCRA(packageJson)) {
      await addBuildscaleToCraRepo(options);
    } else if (isNestCLI(packageJson)) {
      await addBuildscaleToNest(options, packageJson);
    } else if (isMonorepo(packageJson)) {
      await addBuildscaleToMonorepo({ ...options, legacy: true });
    } else {
      await addBuildscaleToNpmRepo({ ...options, legacy: true });
    }
  } else {
    const useDotBuildscaleFolder = await prompt<{ useDotBuildscaleFolder: string }>([
      {
        name: 'useDotBuildscaleFolder',
        type: 'autocomplete',
        message: 'Where should your workspace be created?',
        choices: [
          {
            name: 'In a new folder under this directory',
            value: 'false',
          },
          {
            name: 'In this directory',
            value: 'true',
          },
        ],
      },
    ]).then((r) => r.useDotBuildscaleFolder === 'true');
    if (useDotBuildscaleFolder) {
      setupDotBuildscaleInstallation(version);
    } else {
      execSync(`npx --yes create-buildscale-workspace@${version} ${args}`, {
        stdio: [0, 1, 2],
      });
    }
  }
}

function isCRA(packageJson: PackageJson) {
  const combinedDependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };
  return (
    // Required dependencies for CRA projects
    combinedDependencies['react'] &&
    combinedDependencies['react-dom'] &&
    combinedDependencies['react-scripts'] &&
    // // Don't convert customized CRA projects
    !combinedDependencies['react-app-rewired'] &&
    !combinedDependencies['@craco/craco'] &&
    directoryExists('src') &&
    directoryExists('public')
  );
}

function isNestCLI(packageJson: PackageJson) {
  const combinedDependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };
  return (
    existsSync('nest-cli.json') &&
    combinedDependencies['@nestjs/core'] &&
    combinedDependencies['@nestjs/cli']
  );
}

function setupDotBuildscaleInstallation(version: string) {
  if (process.platform !== 'win32') {
    console.log(
      'Setting Buildscale up installation in `.buildscale`. You can run buildscale commands like: `./buildscale --help`'
    );
  } else {
    console.log(
      'Setting Buildscale up installation in `.buildscale`. You can run buildscale commands like: `./buildscale.bat --help`'
    );
  }
  generateDotBuildscaleSetup(version);
  // invokes the wrapper, thus invoking the initial installation process
  runBuildscaleSync('--version');
}
