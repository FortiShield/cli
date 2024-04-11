import * as enquirer from 'enquirer';
import { unlinkSync, writeFileSync } from 'fs-extra';
import { join } from 'path';
import { InitArgs } from '../init-v1';
import { BuildscaleJsonConfiguration } from '../../../config/buildscale-json';
import { ProjectConfiguration } from '../../../config/workspace-json-project-json';
import {
  fileExists,
  readJsonFile,
  writeJsonFile,
} from '../../../utils/fileutils';
import { output } from '../../../utils/output';
import { PackageJson } from '../../../utils/package-json';
import { getPackageManagerCommand } from '../../../utils/package-manager';
import {
  addDepsToPackageJson,
  createBuildscaleJsonFile,
  initCloud,
  markRootPackageJsonAsBuildscaleProjectLegacy,
  printFinalMessage,
  runInstall,
  updateGitIgnore,
} from './utils';
import { buildscaleVersion } from '../../../utils/versions';
import { connectExistingRepoToBuildscaleCloudPrompt } from '../../connect/connect-to-buildscale-cloud';

type Options = Pick<InitArgs, 'buildscaleCloud' | 'interactive' | 'cacheable'>;
type NestCLIConfiguration = any;

export async function addBuildscaleToNest(options: Options, packageJson: PackageJson) {
  const repoRoot = process.cwd();

  output.log({ title: '🐳 Buildscale initialization' });

  // we check upstream that nest-cli.json exists before it reaches this function
  // so it is guaranteed to be here
  const nestCliJson = readJsonFile(
    join(repoRoot, 'nest-cli.json')
  ) as NestCLIConfiguration;
  const nestCLIConfiguration = mergeWithDefaultConfig(nestCliJson);

  // For NestJS CLI Monorepo, this property is always "true"
  if (nestCLIConfiguration.monorepo) {
    // TODO: update message for NestJS CLI Monorepo support
    output.log({ title: 'NestCLI Monorepo support is coming soon' });
    return;
  }

  const isJS = nestCLIConfiguration.language === 'js';

  const nestCacheableScripts = ['build', 'lint', 'test'];
  const nestIgnoreScripts = [
    'start',
    'start:dev',
    'start:debug',
    'test:cov',
    'test:watch',
  ];

  const scripts = Object.keys(packageJson.scripts ?? {}).filter((s) => {
    if (nestCacheableScripts.includes(s) || nestIgnoreScripts.includes(s)) {
      return false;
    }

    return !s.startsWith('pre') && !s.startsWith('post');
  });

  let cacheableOperations: string[];
  let scriptOutputs = {};
  let useBuildscaleCloud: boolean;

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
            'Which of the following scripts are cacheable? (Produce the same output given the same input, e.g. build, test and lint usually are, serve and start are not)',
          choices: scripts,
        },
      ])) as any
    ).cacheableOperations;

    for (const scriptName of cacheableOperations) {
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

  createBuildscaleJsonFile(
    repoRoot,
    [],
    [...cacheableOperations, ...nestCacheableScripts],
    scriptOutputs
  );

  const pmc = getPackageManagerCommand();

  updateGitIgnore(repoRoot);
  addDepsToPackageJson(repoRoot);
  addNestPluginToPackageJson(repoRoot);
  markRootPackageJsonAsBuildscaleProjectLegacy(repoRoot, cacheableOperations, pmc);

  createProjectJson(repoRoot, packageJson, nestCLIConfiguration);
  removeFile(repoRoot, 'nest-cli.json');

  updatePackageJsonScripts(repoRoot, isJS);
  if (!isJS) {
    updateTsConfig(repoRoot, nestCLIConfiguration.sourceRoot);
  }

  output.log({ title: '📦 Installing dependencies' });

  runInstall(repoRoot);

  if (useBuildscaleCloud) {
    output.log({ title: '🛠️ Setting up Buildscale Cloud' });
    initCloud(repoRoot, 'buildscale-init-nest');
  }

  printFinalMessage({
    learnMoreLink: 'https://buildscale.github.io/recipes/adopting-buildscale/adding-to-monorepo',
  });
}

function addNestPluginToPackageJson(repoRoot: string) {
  const path = join(repoRoot, `package.json`);
  const json: PackageJson = readJsonFile(path);
  json.devDependencies['@buildscale/nest'] = buildscaleVersion;
  json.devDependencies['@buildscale/jest'] = buildscaleVersion;
  writeJsonFile(path, json);
}

function createProjectJson(
  repoRoot: string,
  packageJson: PackageJson,
  nestCLIOptions: NestCLIConfiguration
) {
  const packageName = packageJson.name;
  const path = join(repoRoot, 'project.json');
  const json: ProjectConfiguration = {
    name: packageName,
    root: '.',
    sourceRoot: nestCLIOptions.sourceRoot,
    projectType: 'application',
    targets: {},
    tags: [],
  };
  json['$schema'] = 'node_modules/buildscale/schemas/project-schema.json';

  if (nestCLIOptions.language !== 'js') {
    json.targets['serve'] = {
      executor: '@buildscale/js:node',
      options: {
        buildTarget: `${packageName}:build`,
      },
    };

    console.log(nestCLIOptions);

    if (nestCLIOptions.webpackOptions) {
      json.targets['build'] = {
        executor: '@buildscale/webpack:webpack',
        outputs: ['{options.outputPath}'],
        options: {
          target: 'node',
          compiler: 'tsc',
          outputPath: `dist/${packageName}`,
          main: join(nestCLIOptions.sourceRoot, nestCLIOptions.entryFile),
          tsConfig: 'tsconfig.build.json',
        },
        configurations: {
          production: {
            optimization: true,
            extractLicenses: true,
            inspect: false,
          },
        },
      };
      json.targets['serve'] = {
        ...json.targets['serve'],
        configurations: {
          production: {
            buildTarget: `${packageName}:build:production`,
          },
        },
      };
    } else {
      json.targets['build'] = {
        executor: '@buildscale/js:tsc',
        outputs: ['{options.outputPath}'],
        options: {
          outputPath: `dist/${packageName}`,
          main: join(nestCLIOptions.sourceRoot, nestCLIOptions.entryFile),
          tsConfig: 'tsconfig.build.json',
        },
      };
      json.targets['serve'] = {
        ...json.targets['serve'],
        configurations: {
          debug: {
            inspect: 'inspect',
          },
        },
      };

      // if we're using nrwl/js, then we add nrwl/js analyzeSourceFiles to buildscale.json
      addNrwlJsPluginsConfig(repoRoot);
    }

    // lint
    json.targets['lint'] = {
      executor: '@buildscale/eslint:lint',
      options: {
        lintFilePatterns: ['./src', './test'],
      },
    };

    // test and e2e
    addJestTargets(repoRoot, packageName, json, packageJson);
  }

  writeJsonFile(path, json);
}

function getJestOptions(
  isE2E: boolean,
  repoRoot: string,
  packageName: string,
  existingOptions?: Record<string, unknown>
) {
  // try get the e2e json if we find it
  if (isE2E && !existingOptions) {
    try {
      existingOptions = readJsonFile(join(repoRoot, 'test/jest-e2e.json'));
      removeFile(repoRoot, 'test/jest-e2e.json');
    } catch (e) {}
  }

  const jestOptions = existingOptions || {
    moduleFileExtensions: ['js', 'json', 'ts'],
    testEnvironment: 'node',
    transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  };

  jestOptions['displayName'] = isE2E ? `${packageName}-e2e` : packageName;

  // remove rootDir and testRegex, we'll use testMatch instead since we'll have the
  // root jest.preset.js in the root instead of 'src'
  delete jestOptions['rootDir'];
  delete jestOptions['testRegex'];
  jestOptions['testMatch'] = isE2E
    ? ['<rootDir>/test/**/?(*.)+(e2e-spec|e2e-test).[jt]s?(x)']
    : ['<rootDir>/src/**/*(*.)@(spec|test).[jt]s?(x)'];

  // set coverage directory for unit test
  if (!isE2E) {
    jestOptions['coverageDirectory'] = `./coverage/${packageName}`;
  }

  return jestOptions;
}

function tryCreateJestPreset(repoRoot: string) {
  const jestPresetPath = join(repoRoot, 'jest.preset.js');
  if (!fileExists(jestPresetPath)) {
    writeFileSync(
      jestPresetPath,
      `
const.buildscalew.reset = require('@buildscale/jest/preset').default;
module.exports = {...buildscalew.reset};
`,
      'utf8'
    );
    return true;
  }

  return false;
}

function addJestTargets(
  repoRoot: string,
  packageName: string,
  projectJson: ProjectConfiguration,
  packageJson: PackageJson
) {
  const unitTestOptions = getJestOptions(
    false,
    repoRoot,
    packageName,
    packageJson['jest']
  );
  const unitTestConfigPath = 'jest.config.ts';

  const e2eTestOptions = getJestOptions(true, repoRoot, packageName);
  const e2eTestConfigPath = 'jest.e2e-config.ts';

  const isPresetCreated = tryCreateJestPreset(repoRoot);

  if (isPresetCreated) {
    unitTestOptions['preset'] = e2eTestOptions['preset'] = './jest.preset.js';
  }

  writeFileSync(
    unitTestConfigPath,
    `export default ${JSON.stringify(unitTestOptions, null, 2)}`,
    'utf8'
  );
  writeFileSync(
    e2eTestConfigPath,
    `export default ${JSON.stringify(e2eTestOptions, null, 2)}`,
    'utf8'
  );

  projectJson.targets['test'] = {
    executor: '@buildscale/jest:jest',
    outputs: [`{workspaceRoot}/coverage/${packageName}`],
    options: {
      passWithNoTests: true,
      jestConfig: unitTestConfigPath,
    },
  };

  projectJson.targets['e2e'] = {
    executor: '@buildscale/jest:jest',
    options: {
      passWithNoTests: true,
      jestConfig: e2eTestConfigPath,
    },
  };

  // remove jest options from package.json
  delete packageJson['jest'];
}

function addNrwlJsPluginsConfig(repoRoot: string) {
  const path = join(repoRoot, 'buildscale.json');
  const json: BuildscaleJsonConfiguration = readJsonFile(path);

  if (!json.pluginsConfig) {
    json.pluginsConfig = {
      '@buildscale/js': {
        analyzeSourceFiles: true,
      },
    };
  }

  writeJsonFile(path, json);
}

function updatePackageJsonScripts(repoRoot: string, isJS: boolean) {
  const path = join(repoRoot, `package.json`);
  const json: PackageJson = readJsonFile(path);

  if (json.scripts['build']) {
    json.scripts['build'] = 'buildscale build';
  }

  if (json.scripts['lint']) {
    json.scripts['lint'] = 'buildscale lint';
  }

  if (json.scripts['start:debug']) {
    json.scripts['start:debug'] = 'buildscale serve --configuration=debug';
  }

  if (json.scripts['test']) {
    json.scripts['test'] = 'buildscale test';
  }

  if (json.scripts['test:cov']) {
    delete json.scripts['test:cov'];
  }

  if (json.scripts['test:watch']) {
    delete json.scripts['test:watch'];
  }

  if (json.scripts['test:e2e']) {
    delete json.scripts['test:e2e'];
    json.scripts['e2e'] = .buildscalew.e2e';
  }

  if (!isJS) {
    if (json.scripts['start']) {
      json.scripts['start'] = 'buildscale serve';
    }

    if (json.scripts['start:dev']) {
      // same as buildscale serve
      delete json.scripts['start:dev'];
    }
  }

  writeJsonFile(path, json);
}

function updateTsConfig(repoRoot: string, sourceRoot: string) {
  const path = join(repoRoot, `tsconfig.build.json`);
  const json = readJsonFile(path);

  // we add include to the tsconfig.build because our executor runs tsc with
  // generated tsconfig which is in `tmp/**.generated.json`. By default, tsc
  // cannot find the default source files anymore.
  if (!json.include) json.include = [];
  json.include.push(`${sourceRoot}/**/*.ts`);

  writeJsonFile(path, json);
}

function removeFile(repoRoot: string, file: string) {
  const path = join(repoRoot, file);
  unlinkSync(path);
}

function mergeWithDefaultConfig(config: NestCLIConfiguration) {
  const defaultNestCliConfigurations = {
    language: 'ts',
    sourceRoot: 'src',
    collection: '@nestjs/schematics',
    entryFile: 'main',
    projects: {},
    monorepo: false,
    compilerOptions: {
      tsConfigPath: 'tsconfig.build.json',
      webpack: false,
      webpackConfigPath: 'webpack.config.js',
      plugins: [],
      assets: [],
    },
    generateOptions: {},
  } as NestCLIConfiguration;

  if (config.compilerOptions) {
    return {
      ...defaultNestCliConfigurations,
      ...config,
      compilerOptions: {
        ...defaultNestCliConfigurations.compilerOptions,
        ...config.compilerOptions,
      },
    };
  }

  return { ...defaultNestCliConfigurations, ...config };
}
