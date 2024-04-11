import * as enquirer from 'enquirer';
import { join } from 'path';
import { InitArgs } from '../init-v1';
import { readJsonFile } from '../../../utils/fileutils';
import { output } from '../../../utils/output';
import { getPackageManagerCommand } from '../../../utils/package-manager';
import {
  addDepsToPackageJson,
  createBuildscaleJsonFile,
  initCloud,
  markPackageJsonAsBuildscaleProject,
  markRootPackageJsonAsBuildscaleProjectLegacy,
  printFinalMessage,
  runInstall,
  updateGitIgnore,
} from './utils';
import { connectExistingRepoToBuildscaleCloudPrompt } from '../../connect/connect-to-buildscale-cloud';

type Options = Pick<InitArgs, 'buildscaleCloud' | 'interactive' | 'cacheable'> & {
  legacy?: boolean;
};

export async function addBuildscaleToNpmRepo(options: Options) {
  const repoRoot = process.cwd();

  output.log({ title: '🐳 Buildscale initialization' });

  let cacheableOperations: string[];
  let scriptOutputs = {};
  let useBuildscaleCloud: boolean;

  const packageJson = readJsonFile('package.json');
  const scripts = Object.keys(packageJson.scripts ?? {}).filter(
    (s) => !s.startsWith('pre') && !s.startsWith('post')
  );

  if (options.interactive && scripts.length > 0) {
    output.log({
      title:
        '🧑‍🔧 Please answer the following questions about the scripts found in your package.json in order to generate task runner configuration',
    });

    cacheableOperations = (
      (await enquirer.prompt([
        {
          type: 'multiselect',
          name: 'cacheableOperations',
          message:
            'Which of the following scripts are cacheable? (Produce the same output given the same input, e.g. build, test and lint usually are, serve and start are not). You can use spacebar to select one or more scripts.',
          choices: scripts,
        },
      ])) as any
    ).cacheableOperations;

    for (const scriptName of cacheableOperations) {
      // eslint-disable-next-line no-await-in-loop
      scriptOutputs[scriptName] = (
        await enquirer.prompt([
          {
            type: 'input',
            name: scriptName,
            message: `Does the "${scriptName}" script create any outputs? If not, leave blank, otherwise provide a path (e.g. dist, lib, build, coverage)`,
          },
        ])
      )[scriptName];
    }

    useBuildscaleCloud =
      options.buildscaleCloud ?? (await connectExistingRepoToBuildscaleCloudPrompt());
  } else {
    cacheableOperations = options.cacheable ?? [];
    useBuildscaleCloud =
      options.buildscaleCloud ??
      (options.interactive
        ? await connectExistingRepoToBuildscaleCloudPrompt()
        : false);
  }

  createBuildscaleJsonFile(repoRoot, [], cacheableOperations, scriptOutputs);

  const pmc = getPackageManagerCommand();

  updateGitIgnore(repoRoot);
  addDepsToPackageJson(repoRoot);
  if (options.legacy) {
    markRootPackageJsonAsBuildscaleProjectLegacy(repoRoot, cacheableOperations, pmc);
  } else {
    markPackageJsonAsBuildscaleProject(
      join(repoRoot, 'package.json'),
      cacheableOperations
    );
  }

  output.log({ title: '📦 Installing dependencies' });

  runInstall(repoRoot, pmc);

  if (useBuildscaleCloud) {
    output.log({ title: '🛠️ Setting up Buildscale Cloud' });
    initCloud(repoRoot, 'buildscale-init-npm-repo');
  }

  printFinalMessage({
    learnMoreLink:
      'https://buildscale.github.io/recipes/adopting-buildscale/adding-to-existing-project',
  });
}
