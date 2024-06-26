import { prompt } from 'enquirer';
import { join } from 'path';
import { readJsonFile, writeJsonFile } from '../../../../utils/fileutils';
import { buildscaleVersion } from '../../../../utils/versions';
import { sortObjectByKeys } from '../../../../utils/object-sort';
import { output } from '../../../../utils/output';
import type { PackageJson } from '../../../../utils/package-json';
import {
  addDepsToPackageJson,
  initCloud,
  printFinalMessage,
  runInstall,
  updateGitIgnore,
} from '../utils';
import { setupIntegratedWorkspace } from './integrated-workspace';
import { getLegacyMigrationFunctionIfApplicable } from './legacy-angular-versions';
import { setupStandaloneWorkspace } from './standalone-workspace';
import type { AngularJsonConfig, Options } from './types';
import { connectExistingRepoToBuildscaleCloudPrompt } from '../../../connect/connect-to-buildscale-cloud';

const defaultCacheableOperations: string[] = [
  'build',
  'server',
  'test',
  'lint',
];

let repoRoot: string;
let workspaceTargets: string[];

export async function addBuildscaleToAngularCliRepo(options: Options) {
  repoRoot = process.cwd();

  output.log({ title: '🧐 Checking versions compatibility' });
  const legacyMigrationFn = await getLegacyMigrationFunctionIfApplicable(
    repoRoot,
    options
  );
  if (legacyMigrationFn) {
    output.log({ title: '💽 Running migration for a legacy Angular version' });
    await legacyMigrationFn();
    process.exit(0);
  }

  output.success({
    title:
      '✅ The Angular version is compatible with the latest version of Buildscale.',
  });

  output.log({ title: '🐳 Buildscale initialization' });
  const cacheableOperations = !options.integrated
    ? await collectCacheableOperations(options)
    : [];
  const useBuildscaleCloud =
    options.buildscaleCloud ??
    (options.interactive ? await connectExistingRepoToBuildscaleCloudPrompt() : false);

  output.log({ title: '📦 Installing dependencies' });
  installDependencies();

  output.log({ title: '📝 Setting up workspace' });
  await setupWorkspace(cacheableOperations, options.integrated);

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
}

async function collectCacheableOperations(options: Options): Promise<string[]> {
  let cacheableOperations: string[];

  workspaceTargets = getWorkspaceTargets();
  const defaultCacheableTargetsInWorkspace = defaultCacheableOperations.filter(
    (t) => workspaceTargets.includes(t)
  );

  if (options.interactive && workspaceTargets.length > 0) {
    output.log({
      title:
        '🧑‍🔧 Please answer the following questions about the targets found in your angular.json in order to generate task runner configuration',
    });

    cacheableOperations = (
      (await prompt([
        {
          type: 'multiselect',
          name: 'cacheableOperations',
          initial: defaultCacheableTargetsInWorkspace as any,
          message:
            'Which of the following targets are cacheable? (Produce the same output given the same input, e.g. build, test and lint usually are, serve and start are not)',
          // enquirer mutates the array below, create a new one to avoid it
          choices: [...workspaceTargets],
        },
      ])) as any
    ).cacheableOperations;
  } else {
    cacheableOperations =
      options.cacheable ?? defaultCacheableTargetsInWorkspace;
  }

  return cacheableOperations;
}

function installDependencies(): void {
  addDepsToPackageJson(repoRoot);
  addPluginDependencies();
  runInstall(repoRoot);
}

function addPluginDependencies(): void {
  const packageJsonPath = join(repoRoot, 'package.json');
  const packageJson = readJsonFile<PackageJson>(packageJsonPath);

  packageJson.devDependencies ??= {};
  packageJson.devDependencies['@buildscale/angular'] = buildscaleVersion;
  packageJson.devDependencies['@buildscale/workspace'] = buildscaleVersion;

  const peerDepsToInstall = [
    '@angular-devkit/core',
    '@angular-devkit/schematics',
    '@schematics/angular',
  ];
  const angularCliVersion =
    packageJson.devDependencies['@angular/cli'] ??
    packageJson.dependencies?.['@angular/cli'] ??
    packageJson.devDependencies['@angular-devkit/build-angular'] ??
    packageJson.dependencies?.['@angular-devkit/build-angular'];

  for (const dep of peerDepsToInstall) {
    if (!packageJson.devDependencies[dep] && !packageJson.dependencies?.[dep]) {
      packageJson.devDependencies[dep] = angularCliVersion;
    }
  }

  packageJson.devDependencies = sortObjectByKeys(packageJson.devDependencies);

  writeJsonFile(packageJsonPath, packageJson);
}

async function setupWorkspace(
  cacheableOperations: string[],
  isIntegratedMigration: boolean
): Promise<void> {
  updateGitIgnore(repoRoot);

  if (isIntegratedMigration) {
    setupIntegratedWorkspace();
  } else {
    await setupStandaloneWorkspace(
      repoRoot,
      cacheableOperations,
      workspaceTargets
    );
  }
}

function getWorkspaceTargets(): string[] {
  const { projects } = readJsonFile<AngularJsonConfig>(
    join(repoRoot, 'angular.json')
  );
  const targets = new Set<string>();
  for (const project of Object.values(projects ?? {})) {
    for (const target of Object.keys(project.architect ?? {})) {
      targets.add(target);
    }
  }

  return Array.from(targets);
}
