import * as yargsParser from 'yargs-parser';
import type { Arguments } from 'yargs';
import { TEN_MEGABYTES } from '../project-graph/file-utils';
import { output } from './output';
import { BuildscaleJsonConfiguration } from '../config/buildscale-json';
import { execSync } from 'child_process';
import { ProjectGraph } from '../config/project-graph';
import { workspaceRoot } from './workspace-root';

export interface RawBuildscaleArgs extends BuildscaleArgs {
  prod?: boolean;
}

export interface BuildscaleArgs {
  targets?: string[];
  configuration?: string;
  runner?: string;
  parallel?: number;
  untracked?: boolean;
  uncommitted?: boolean;
  all?: boolean;
  base?: string;
  head?: string;
  exclude?: string[];
  files?: string[];
  verbose?: boolean;
  help?: boolean;
  version?: boolean;
  plain?: boolean;
  projects?: string[];
  select?: string;
  graph?: string | boolean;
  skipBuildscaleCache?: boolean;
  outputStyle?: string;
  buildscaleBail?: boolean;
  buildscaleIgnoreCycles?: boolean;
  type?: string;
  batch?: boolean;
}

export function createOverrides(__overrides_unparsed__: string[] = []) {
  let overrides =
    yargsParser(__overrides_unparsed__, {
      configuration: {
        'camel-case-expansion': false,
        'dot-notation': true,
      },
    }) || {};

  if (!overrides._ || overrides._.length === 0) {
    delete overrides._;
  }

  overrides.__overrides_unparsed__ = __overrides_unparsed__;
  return overrides;
}

export function splitArgsIntoBuildscaleArgsAndOverrides(
  args: { [k: string]: any },
  mode: 'run-one' | 'run-many' | 'affected' | 'print-affected',
  options = { printWarnings: true },
  buildscaleJson: BuildscaleJsonConfiguration
): {
  buildscaleArgs: BuildscaleArgs;
  overrides: Arguments & { __overrides_unparsed__: string[] };
} {
  // this is to lerna case when this function is invoked imperatively
  if (args['target'] && !args['targets']) {
    args['targets'] = [args['target']];
  }
  delete args['target'];
  delete args['t'];

  if (!args.__overrides_unparsed__ && args._) {
    // required for backwards compatibility
    args.__overrides_unparsed__ = args._;
    delete args._;
  }
  // This handles the way Lerna passes in overrides
  if (!args.__overrides_unparsed__ && args.__overrides__) {
    // required for backwards compatibility
    args.__overrides_unparsed__ = args.__overrides__;
    delete args._;
  }

  const buildscaleArgs: RawBuildscaleArgs = args;

  let overrides = createOverrides(args.__overrides_unparsed__);
  delete (buildscaleArgs as any).$0;
  delete (buildscaleArgs as any).__overrides_unparsed__;

  if (mode === 'run-many') {
    const args = buildscaleArgs as any;
    if (!args.projects) {
      args.projects = [];
    } else if (typeof args.projects === 'string') {
      args.projects = args.projects.split(',');
    }
  }

  if (buildscaleArgs.prod) {
    delete buildscaleArgs.prod;
    buildscaleArgs.configuration = 'production';
  }

  if (mode === 'affected') {
    if (options.printWarnings && buildscaleArgs.all) {
      output.warn({
        title: `Running affected:* commands with --all can result in very slow builds.`,
        bodyLines: [
          `${output.bold(
            '--all'
          )} is not meant to be used for any sizable project or to be used in CI.`,
          '',
          `${output.dim(
            'Learn more about checking only what is affected: https://buildscale.github.io/buildscale/affected'
          )}`,
        ],
      });
    }

    // Allow setting base and head via environment variables (lower priority then direct command arguments)
    if (!buildscaleArgs.base && process.env.BUILDSCALE_BASE) {
      buildscaleArgs.base = process.env.BUILDSCALE_BASE;
      if (options.printWarnings) {
        output.note({
          title: `No explicit --base argument provided, but found environment variable BUILDSCALE_BASE so using its value as the affected base: ${output.bold(
            `${buildscaleArgs.base}`
          )}`,
        });
      }
    }
    if (!buildscaleArgs.head && process.env.BUILDSCALE_HEAD) {
      buildscaleArgs.head = process.env.BUILDSCALE_HEAD;
      if (options.printWarnings) {
        output.note({
          title: `No explicit --head argument provided, but found environment variable BUILDSCALE_HEAD so using its value as the affected head: ${output.bold(
            `${buildscaleArgs.head}`
          )}`,
        });
      }
    }

    if (!buildscaleArgs.base) {
      buildscaleArgs.base =
        buildscaleJson.defaultBase ?? buildscaleJson.affected?.defaultBase ?? 'main';

      // No user-provided arguments to set the affected criteria, so inform the user of the defaults being used
      if (
        options.printWarnings &&
        !buildscaleArgs.head &&
        !buildscaleArgs.files &&
        !buildscaleArgs.uncommitted &&
        !buildscaleArgs.untracked &&
        !buildscaleArgs.all
      ) {
        output.note({
          title: `Affected criteria defaulted to --base=${output.bold(
            `${buildscaleArgs.base}`
          )} --head=${output.bold('HEAD')}`,
        });
      }
    }

    if (buildscaleArgs.base) {
      buildscaleArgs.base = getMergeBase(buildscaleArgs.base, buildscaleArgs.head);
    }
  }

  if (typeof args.exclude === 'string') {
    buildscaleArgs.exclude = args.exclude.split(',');
  }

  if (!buildscaleArgs.skipBuildscaleCache) {
    buildscaleArgs.skipBuildscaleCache = process.env.BUILDSCALE_SKIP_BUILDSCALE_CACHE === 'true';
  }

  normalizeBuildscaleArgsRunner(buildscaleArgs, buildscaleJson, options);

  if (args['parallel'] === 'false' || args['parallel'] === false) {
    buildscaleArgs['parallel'] = 1;
  } else if (
    args['parallel'] === 'true' ||
    args['parallel'] === true ||
    args['parallel'] === '' ||
    process.env.BUILDSCALE_PARALLEL // dont require passing --parallel if BUILDSCALE_PARALLEL is set
  ) {
    buildscaleArgs['parallel'] = Number(
      buildscaleArgs['maxParallel'] ||
        buildscaleArgs['max-parallel'] ||
        process.env.BUILDSCALE_PARALLEL ||
        3
    );
  } else if (args['parallel'] !== undefined) {
    buildscaleArgs['parallel'] = Number(args['parallel']);
  }

  return { buildscaleArgs, overrides } as any;
}

function normalizeBuildscaleArgsRunner(
  buildscaleArgs: RawBuildscaleArgs,
  buildscaleJson: BuildscaleJsonConfiguration<string[] | '*'>,
  options: { printWarnings: boolean }
) {
  if (!buildscaleArgs.runner) {
    // TODO: Remove BUILDSCALE_RUNNER environment variable support in Buildscale v17
    for (const envKey of ['BUILDSCALE_TASKS_RUNNER', 'BUILDSCALE_RUNNER']) {
      const runner = process.env[envKey];
      if (runner) {
        const runnerExists = buildscaleJson.tasksRunnerOptions?.[runner];
        if (options.printWarnings) {
          if (runnerExists) {
            output.note({
              title: `No explicit --runner argument provided, but found environment variable ${envKey} so using its value: ${output.bold(
                `${runner}`
              )}`,
            });
          } else if (
            buildscaleArgs.verbose ||
            process.env.BUILDSCALE_VERBOSE_LOGGING === 'true'
          ) {
            output.warn({
              title: `Could not find ${output.bold(
                `${runner}`
              )} within \`buildscale.json\` tasksRunnerOptions.`,
              bodyLines: [
                `${output.bold(`${runner}`)} was set by ${envKey}`,
                ``,
                `To suppress this message, either:`,
                `  - provide a valid task runner with --runner`,
                `  - ensure BUILDSCALE_TASKS_RUNNER matches a task runner defined in buildscale.json`,
              ],
            });
          }
        }
        if (runnerExists) {
          // TODO: Remove in v17
          if (envKey === 'BUILDSCALE_RUNNER' && options.printWarnings) {
            output.warn({
              title:
                'BUILDSCALE_RUNNER is deprecated, please use BUILDSCALE_TASKS_RUNNER instead.',
            });
          }
          buildscaleArgs.runner = runner;
        }
        break;
      }
    }
  }
}

export function parseFiles(options: BuildscaleArgs): { files: string[] } {
  const { files, uncommitted, untracked, base, head } = options;

  if (files) {
    return {
      files,
    };
  } else if (uncommitted) {
    return {
      files: getUncommittedFiles(),
    };
  } else if (untracked) {
    return {
      files: getUntrackedFiles(),
    };
  } else if (base && head) {
    return {
      files: getFilesUsingBaseAndHead(base, head),
    };
  } else if (base) {
    return {
      files: Array.from(
        new Set([
          ...getFilesUsingBaseAndHead(base, 'HEAD'),
          ...getUncommittedFiles(),
          ...getUntrackedFiles(),
        ])
      ),
    };
  }
}

function getUncommittedFiles(): string[] {
  return parseGitOutput(`git diff --name-only --no-renames --relative HEAD .`);
}

function getUntrackedFiles(): string[] {
  return parseGitOutput(`git ls-files --others --exclude-standard`);
}

function getMergeBase(base: string, head: string = 'HEAD') {
  try {
    return execSync(`git merge-base "${base}" "${head}"`, {
      maxBuffer: TEN_MEGABYTES,
      cwd: workspaceRoot,
      stdio: 'pipe',
    })
      .toString()
      .trim();
  } catch {
    try {
      return execSync(`git merge-base --fork-point "${base}" "${head}"`, {
        maxBuffer: TEN_MEGABYTES,
        cwd: workspaceRoot,
        stdio: 'pipe',
      })
        .toString()
        .trim();
    } catch {
      return base;
    }
  }
}

function getFilesUsingBaseAndHead(base: string, head: string): string[] {
  return parseGitOutput(
    `git diff --name-only --no-renames --relative "${base}" "${head}"`
  );
}

function parseGitOutput(command: string): string[] {
  return execSync(command, { maxBuffer: TEN_MEGABYTES, cwd: workspaceRoot })
    .toString('utf-8')
    .split('\n')
    .map((a) => a.trim())
    .filter((a) => a.length > 0);
}

export function getProjectRoots(
  projectNames: string[],
  { nodes }: ProjectGraph
): string[] {
  return projectNames.map((name) => nodes[name].data.root);
}

export function readGraphFileFromGraphArg({ graph }: Pick<BuildscaleArgs, 'graph'>) {
  return typeof graph === 'string' && graph !== 'true' && graph !== ''
    ? graph
    : undefined;
}
