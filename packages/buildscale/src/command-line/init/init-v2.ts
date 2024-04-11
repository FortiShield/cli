import { existsSync } from 'fs';
import { PackageJson } from '../../utils/package-json';
import { prerelease } from 'semver';
import { output } from '../../utils/output';
import { getPackageManagerCommand } from '../../utils/package-manager';
import { generateDotBuildscaleSetup } from './implementation/dot-buildscale/add-buildscale-scripts';
import { runBuildscaleSync } from '../../utils/child-process';
import { readJsonFile, writeJsonFile } from '../../utils/fileutils';
import { buildscaleVersion } from '../../utils/versions';
import {
  addDepsToPackageJson,
  createBuildscaleJsonFile,
  isMonorepo,
  runInstall,
  updateGitIgnore,
} from './implementation/utils';
import { prompt } from 'enquirer';
import { execSync } from 'child_process';
import { addBuildscaleToAngularCliRepo } from './implementation/angular';
import { globWithWorkspaceContext } from '../../utils/workspace-context';
import { connectExistingRepoToBuildscaleCloudPrompt } from '../connect/connect-to-buildscale-cloud';
import { addBuildscaleToNpmRepo } from './implementation/add-buildscale-to-npm-repo';
import { addBuildscaleToMonorepo } from './implementation/add-buildscale-to-monorepo';
import { join } from 'path';

export interface InitArgs {
  interactive: boolean;
  buildscaleCloud?: boolean;
  useDotBuildscaleInstallation?: boolean;
  integrated?: boolean; // For Angular projects only
}

export async function initHandler(options: InitArgs): Promise<void> {
  process.env.BUILDSCALE_RUNNING_BUILDSCALE_INIT = 'true';
  const version =
    process.env.BUILDSCALE_VERSION ?? (prerelease(buildscaleVersion) ? 'next' : 'latest');
  if (process.env.BUILDSCALE_VERSION) {
    output.log({ title: `Using version ${process.env.BUILDSCALE_VERSION}` });
  }

  if (!existsSync('package.json') || options.useDotBuildscaleInstallation) {
    if (process.platform !== 'win32') {
      console.log(
        'Setting Buildscale up installation in `.buildscale`. You can run Buildscale commands like: `./buildscale --help`'
      );
    } else {
      console.log(
        'Setting Buildscale up installation in `.buildscale`. You can run Buildscale commands like: `./buildscale.bat --help`'
      );
    }
    generateDotBuildscaleSetup(version);
    const { plugins } = await detectPlugins();
    plugins.forEach((plugin) => {
      execSync(`./buildscale add ${plugin}`, {
        stdio: 'inherit',
      });
    });

    // invokes the wrapper, thus invoking the initial installation process
    runBuildscaleSync('--version', { stdio: 'ignore' });
    return;
  }

  // TODO(jack): Remove this Angular logic once `@buildscale/angular` is compatible with inferred targets.
  if (existsSync('angular.json')) {
    await addBuildscaleToAngularCliRepo({
      ...options,
      integrated: !!options.integrated,
    });
    return;
  }

  output.log({ title: '🧐 Checking dependencies' });

  const { plugins, updatePackageScripts } = await detectPlugins();

  if (!plugins.length) {
    // If no plugins are detected/chosen, guide users to setup
    // their targetDefaults correctly so their package scripts will work.
    const packageJson: PackageJson = readJsonFile('package.json');
    if (isMonorepo(packageJson)) {
      await addBuildscaleToMonorepo({ interactive: options.interactive });
    } else {
      await addBuildscaleToNpmRepo({ interactive: options.interactive });
    }
  } else {
    const useBuildscaleCloud =
      options.buildscaleCloud ??
      (options.interactive
        ? await connectExistingRepoToBuildscaleCloudPrompt()
        : false);

    const repoRoot = process.cwd();
    const pmc = getPackageManagerCommand();

    createBuildscaleJsonFile(repoRoot, [], [], {});
    updateGitIgnore(repoRoot);

    addDepsToPackageJson(repoRoot, plugins);

    output.log({ title: '📦 Installing Buildscale' });

    runInstall(repoRoot, pmc);

    output.log({ title: '🔨 Configuring plugins' });
    for (const plugin of plugins) {
      execSync(
        `${pmc.exec} buildscale g ${plugin}:init --keepExistingVersions ${
          updatePackageScripts ? '--updatePackageScripts' : ''
        } --no-interactive`,
        {
          stdio: [0, 1, 2],
          cwd: repoRoot,
        }
      );
    }

    if (!updatePackageScripts) {
      const rootPackageJsonPath = join(repoRoot, 'package.json');
      const json = readJsonFile<PackageJson>(rootPackageJsonPath);
      json.buildscale = { includedScripts: [] };
      writeJsonFile(rootPackageJsonPath, json);
    }

    if (useBuildscaleCloud) {
      output.log({ title: '🛠️ Setting up Buildscale Cloud' });
      execSync(
        `${pmc.exec} buildscale g buildscale:connect-to-buildscale-cloud --installationSource=buildscale-init --quiet --hideFormatLogs --no-interactive`,
        {
          stdio: [0, 1, 2],
          cwd: repoRoot,
        }
      );
    }
  }

  output.log({
    title: '👀 Explore Your Workspace',
    bodyLines: [
      `Run "buildscale graph" to show the graph of the workspace. It will show tasks that you can run with Buildscale.`,
      `Read this guide on exploring your workspace: https://buildscale.github.io/core-features/explore-graph`,
    ],
  });
}

const npmPackageToPluginMap: Record<string, string> = {
  // Generic JS tools
  eslint: '@buildscale/eslint',
  storybook: '@buildscale/storybook',
  // Bundlers
  vite: '@buildscale/vite',
  vitest: '@buildscale/vite',
  webpack: '@buildscale/webpack',
  rollup: '@buildscale/rollup',
  // Testing tools
  jest: '@buildscale/jest',
  cypress: '@buildscale/cypress',
  '@playwright/test': '@buildscale/playwright',
  // Frameworks
  detox: '@buildscale/detox',
  expo: '@buildscale/expo',
  next: '@buildscale/next',
  nuxt: '@buildscale/nuxt',
  'react-native': '@buildscale/react-native',
  '@remix-run/dev': '@buildscale/remix',
};

async function detectPlugins(): Promise<{
  plugins: string[];
  updatePackageScripts: boolean;
}> {
  let files = ['package.json'].concat(
    globWithWorkspaceContext(process.cwd(), ['**/*/package.json'])
  );

  const detectedPlugins = new Set<string>();
  for (const file of files) {
    if (!existsSync(file)) continue;

    let packageJson: PackageJson;
    try {
      packageJson = readJsonFile(file);
    } catch {
      // Could have malformed JSON for unit tests, etc.
      continue;
    }

    const deps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    for (const [dep, plugin] of Object.entries(npmPackageToPluginMap)) {
      if (deps[dep]) {
        detectedPlugins.add(plugin);
      }
    }
  }
  if (existsSync('gradlew') || existsSync('gradlew.bat')) {
    detectedPlugins.add('@buildscale/gradle');
  }

  const plugins = Array.from(detectedPlugins);

  if (plugins.length === 0) {
    return {
      plugins: [],
      updatePackageScripts: false,
    };
  }

  output.log({
    title: `Recommended Plugins:`,
    bodyLines: [
      `Add these Buildscale plugins to integrate with the tools used in your workspace.`,
    ],
  });

  const pluginsToInstall = await prompt<{ plugins: string[] }>([
    {
      name: 'plugins',
      type: 'multiselect',
      message: `Which plugins would you like to add?`,
      choices: plugins.map((p) => ({ name: p, value: p })),
      initial: plugins.map((_, i) => i) as unknown as number, // casting to avoid type error due to bad d.ts file from enquirer
    },
  ]).then((r) => r.plugins);

  if (pluginsToInstall?.length === 0)
    return {
      plugins: [],
      updatePackageScripts: false,
    };

  const updatePackageScripts =
    existsSync('package.json') &&
    (await prompt<{ updatePackageScripts: string }>([
      {
        name: 'updatePackageScripts',
        type: 'autocomplete',
        message: `Do you want to start using Buildscale in your package.json scripts?`,
        choices: [
          {
            name: 'Yes',
          },
          {
            name: 'No',
          },
        ],
        initial: 0,
      },
    ]).then((r) => r.updatePackageScripts === 'Yes'));

  return { plugins: pluginsToInstall, updatePackageScripts };
}
