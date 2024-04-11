import { TasksRunner, TaskStatus } from './tasks-runner';
import { join } from 'path';
import { workspaceRoot } from '../utils/workspace-root';
import { BuildscaleArgs } from '../utils/command-line-utils';
import { isRelativePath } from '../utils/fileutils';
import { output } from '../utils/output';
import { shouldStreamOutput } from './utils';
import { CompositeLifeCycle, LifeCycle } from './life-cycle';
import { StaticRunManyTerminalOutputLifeCycle } from './life-cycles/static-run-many-terminal-output-life-cycle';
import { StaticRunOneTerminalOutputLifeCycle } from './life-cycles/static-run-one-terminal-output-life-cycle';
import { TaskTimingsLifeCycle } from './life-cycles/task-timings-life-cycle';
import { createRunManyDynamicOutputRenderer } from './life-cycles/dynamic-run-many-terminal-output-life-cycle';
import { TaskProfilingLifeCycle } from './life-cycles/task-profiling-life-cycle';
import { isCI } from '../utils/is-ci';
import { createRunOneDynamicOutputRenderer } from './life-cycles/dynamic-run-one-terminal-output-life-cycle';
import { ProjectGraph, ProjectGraphProjectNode } from '../config/project-graph';
import {
  BuildscaleJsonConfiguration,
  TargetDefaults,
  TargetDependencies,
} from '../config/buildscale-json';
import { Task, TaskGraph } from '../config/task-graph';
import { createTaskGraph } from './create-task-graph';
import { findCycle, makeAcyclic } from './task-graph-utils';
import { TargetDependencyConfig } from '../config/workspace-json-project-json';
import { handleErrors } from '../utils/params';
import { hashTasksThatDoNotDependOnOutputsOfOtherTasks } from '../hasher/hash-task';
import { daemonClient } from '../daemon/client/client';
import { StoreRunInformationLifeCycle } from './life-cycles/store-run-information-life-cycle';
import { createTaskHasher } from '../hasher/create-task-hasher';

async function getTerminalOutputLifeCycle(
  initiatingProject: string,
  projectNames: string[],
  tasks: Task[],
  buildscaleArgs: BuildscaleArgs,
  buildscaleJson: BuildscaleJsonConfiguration,
  overrides: Record<string, unknown>
): Promise<{ lifeCycle: LifeCycle; renderIsDone: Promise<void> }> {
  const { runnerOptions } = getRunner(buildscaleArgs, buildscaleJson);
  const isRunOne = initiatingProject != null;
  const useDynamicOutput = shouldUseDynamicLifeCycle(
    tasks,
    runnerOptions,
    buildscaleArgs.outputStyle
  );

  const overridesWithoutHidden = { ...overrides };
  delete overridesWithoutHidden['__overrides_unparsed__'];

  if (isRunOne) {
    if (useDynamicOutput) {
      return await createRunOneDynamicOutputRenderer({
        initiatingProject,
        tasks,
        args: buildscaleArgs,
        overrides: overridesWithoutHidden,
      });
    }
    return {
      lifeCycle: new StaticRunOneTerminalOutputLifeCycle(
        initiatingProject,
        projectNames,
        tasks,
        buildscaleArgs
      ),
      renderIsDone: Promise.resolve(),
    };
  } else {
    if (useDynamicOutput) {
      return await createRunManyDynamicOutputRenderer({
        projectNames,
        tasks,
        args: buildscaleArgs,
        overrides: overridesWithoutHidden,
      });
    } else {
      return {
        lifeCycle: new StaticRunManyTerminalOutputLifeCycle(
          projectNames,
          tasks,
          buildscaleArgs,
          overridesWithoutHidden
        ),
        renderIsDone: Promise.resolve(),
      };
    }
  }
}

function createTaskGraphAndValidateCycles(
  projectGraph: ProjectGraph,
  defaultDependencyConfigs: TargetDependencies,
  projectNames: string[],
  buildscaleArgs: BuildscaleArgs,
  overrides: any,
  extraOptions: {
    excludeTaskDependencies: boolean;
    loadDotEnvFiles: boolean;
  }
) {
  const taskGraph = createTaskGraph(
    projectGraph,
    defaultDependencyConfigs,
    projectNames,
    buildscaleArgs.targets,
    buildscaleArgs.configuration,
    overrides,
    extraOptions.excludeTaskDependencies
  );

  const cycle = findCycle(taskGraph);
  if (cycle) {
    if (process.env.BUILDSCALE_IGNORE_CYCLES === 'true' || buildscaleArgs.buildscaleIgnoreCycles) {
      output.warn({
        title: `The task graph has a circular dependency`,
        bodyLines: [`${cycle.join(' --> ')}`],
      });
      makeAcyclic(taskGraph);
    } else {
      output.error({
        title: `Could not execute command because the task graph has a circular dependency`,
        bodyLines: [`${cycle.join(' --> ')}`],
      });
      process.exit(1);
    }
  }

  return taskGraph;
}

export async function runCommand(
  projectsToRun: ProjectGraphProjectNode[],
  projectGraph: ProjectGraph,
  { buildscaleJson }: { buildscaleJson: BuildscaleJsonConfiguration },
  buildscaleArgs: BuildscaleArgs,
  overrides: any,
  initiatingProject: string | null,
  extraTargetDependencies: Record<string, (TargetDependencyConfig | string)[]>,
  extraOptions: { excludeTaskDependencies: boolean; loadDotEnvFiles: boolean }
): Promise<NodeJS.Process['exitCode']> {
  const status = await handleErrors(
    process.env.BUILDSCALE_VERBOSE_LOGGING === 'true',
    async () => {
      const defaultDependencyConfigs = mergeTargetDependencies(
        buildscaleJson.targetDefaults,
        extraTargetDependencies
      );
      const projectNames = projectsToRun.map((t) => t.name);

      const taskGraph = createTaskGraphAndValidateCycles(
        projectGraph,
        defaultDependencyConfigs,
        projectNames,
        buildscaleArgs,
        overrides,
        extraOptions
      );
      const tasks = Object.values(taskGraph.tasks);

      const { lifeCycle, renderIsDone } = await getTerminalOutputLifeCycle(
        initiatingProject,
        projectNames,
        tasks,
        buildscaleArgs,
        buildscaleJson,
        overrides
      );

      const status = await invokeTasksRunner({
        tasks,
        projectGraph,
        taskGraph,
        lifeCycle,
        buildscaleJson,
        buildscaleArgs,
        loadDotEnvFiles: extraOptions.loadDotEnvFiles,
        initiatingProject,
      });

      await renderIsDone;

      return status;
    }
  );

  return status;
}

function setEnvVarsBasedOnArgs(buildscaleArgs: BuildscaleArgs, loadDotEnvFiles: boolean) {
  if (
    buildscaleArgs.outputStyle == 'stream' ||
    process.env.BUILDSCALE_BATCH_MODE === 'true' ||
    buildscaleArgs.batch
  ) {
    process.env.BUILDSCALE_STREAM_OUTPUT = 'true';
    process.env.BUILDSCALE_PREFIX_OUTPUT = 'true';
  }
  if (buildscaleArgs.outputStyle == 'stream-without-prefixes') {
    process.env.BUILDSCALE_STREAM_OUTPUT = 'true';
  }
  if (loadDotEnvFiles) {
    process.env.BUILDSCALE_LOAD_DOT_ENV_FILES = 'true';
  }
}

export async function invokeTasksRunner({
  tasks,
  projectGraph,
  taskGraph,
  lifeCycle,
  buildscaleJson,
  buildscaleArgs,
  loadDotEnvFiles,
  initiatingProject,
}: {
  tasks: Task[];
  projectGraph: ProjectGraph;
  taskGraph: TaskGraph;
  lifeCycle: LifeCycle;
  buildscaleJson: BuildscaleJsonConfiguration;
  buildscaleArgs: BuildscaleArgs;
  loadDotEnvFiles: boolean;
  initiatingProject: string | null;
}) {
  setEnvVarsBasedOnArgs(buildscaleArgs, loadDotEnvFiles);

  const { tasksRunner, runnerOptions } = getRunner(buildscaleArgs, buildscaleJson);

  let hasher = createTaskHasher(projectGraph, buildscaleJson, runnerOptions);

  // this is used for two reasons: to fetch all remote cache hits AND
  // to submit everything that is known in advance to Buildscale Cloud to run in
  // a distributed fashion

  await hashTasksThatDoNotDependOnOutputsOfOtherTasks(
    hasher,
    projectGraph,
    taskGraph,
    buildscaleJson
  );

  const promiseOrObservable = tasksRunner(
    tasks,
    {
      ...runnerOptions,
      lifeCycle: new CompositeLifeCycle(constructLifeCycles(lifeCycle)),
    },
    {
      initiatingProject:
        buildscaleArgs.outputStyle === 'compact' ? null : initiatingProject,
      projectGraph,
      buildscaleJson,
      buildscaleArgs,
      taskGraph,
      hasher: {
        hashTask(task: Task, taskGraph_?: TaskGraph, env?: NodeJS.ProcessEnv) {
          if (!taskGraph_) {
            output.warn({
              title: `TaskGraph is now required as an argument to hashTask`,
              bodyLines: [
                `The TaskGraph object can be retrieved from the context`,
                'This will result in an error in Buildscale 19',
              ],
            });
            taskGraph_ = taskGraph;
          }
          if (!env) {
            output.warn({
              title: `The environment variables are now required as an argument to hashTask`,
              bodyLines: [
                `Please pass the environment variables used when running the task`,
                'This will result in an error in Buildscale 19',
              ],
            });
            env = process.env;
          }
          return hasher.hashTask(task, taskGraph_, env);
        },
        hashTasks(
          task: Task[],
          taskGraph_?: TaskGraph,
          env?: NodeJS.ProcessEnv
        ) {
          if (!taskGraph_) {
            output.warn({
              title: `TaskGraph is now required as an argument to hashTasks`,
              bodyLines: [
                `The TaskGraph object can be retrieved from the context`,
                'This will result in an error in Buildscale 19',
              ],
            });
            taskGraph_ = taskGraph;
          }
          if (!env) {
            output.warn({
              title: `The environment variables are now required as an argument to hashTasks`,
              bodyLines: [
                `Please pass the environment variables used when running the tasks`,
                'This will result in an error in Buildscale 19',
              ],
            });
            env = process.env;
          }

          return hasher.hashTasks(task, taskGraph_, env);
        },
      },
      daemon: daemonClient,
    }
  );
  let anyFailures;
  if ((promiseOrObservable as any).subscribe) {
    anyFailures = await anyFailuresInObservable(promiseOrObservable);
  } else {
    // simply await the promise
    anyFailures = await anyFailuresInPromise(promiseOrObservable as any);
  }
  return anyFailures ? 1 : 0;
}

function constructLifeCycles(lifeCycle: LifeCycle) {
  const lifeCycles = [] as LifeCycle[];
  lifeCycles.push(new StoreRunInformationLifeCycle());
  lifeCycles.push(lifeCycle);
  if (process.env.BUILDSCALE_PERF_LOGGING === 'true') {
    lifeCycles.push(new TaskTimingsLifeCycle());
  }
  if (process.env.BUILDSCALE_PROFILE) {
    lifeCycles.push(new TaskProfilingLifeCycle(process.env.BUILDSCALE_PROFILE));
  }
  return lifeCycles;
}

function mergeTargetDependencies(
  defaults: TargetDefaults | undefined | null,
  deps: TargetDependencies
): TargetDependencies {
  const res = {};
  Object.keys(defaults ?? {}).forEach((k) => {
    res[k] = defaults[k].dependsOn;
  });
  if (deps) {
    Object.keys(deps).forEach((k) => {
      if (res[k]) {
        res[k] = [...res[k], deps[k]];
      } else {
        res[k] = deps[k];
      }
    });

    return res;
  }
}

async function anyFailuresInPromise(
  promise: Promise<{ [id: string]: TaskStatus }>
) {
  return Object.values(await promise).some(
    (v) => v === 'failure' || v === 'skipped'
  );
}

async function anyFailuresInObservable(obs: any) {
  return await new Promise((res) => {
    let anyFailures = false;
    obs.subscribe(
      (t) => {
        if (!t.success) {
          anyFailures = true;
        }
      },
      (error) => {
        output.error({
          title: 'Unhandled error in task executor',
        });
        console.error(error);
        res(true);
      },
      () => {
        res(anyFailures);
      }
    );
  });
}

function shouldUseDynamicLifeCycle(
  tasks: Task[],
  options: any,
  outputStyle: string
) {
  if (
    process.env.BUILDSCALE_BATCH_MODE === 'true' ||
    process.env.BUILDSCALE_VERBOSE_LOGGING === 'true' ||
    process.env.BUILDSCALE_TASKS_RUNNER_DYNAMIC_OUTPUT === 'false'
  ) {
    return false;
  }
  if (!process.stdout.isTTY) return false;
  if (isCI()) return false;
  if (outputStyle === 'static' || outputStyle === 'stream') return false;

  return !tasks.find((t) => shouldStreamOutput(t, null));
}

function loadTasksRunner(modulePath: string) {
  try {
    const maybeTasksRunner = require(modulePath) as
      | TasksRunner
      | { default: TasksRunner };
    // to support both babel and ts formats
    return 'default' in maybeTasksRunner
      ? maybeTasksRunner.default
      : maybeTasksRunner;
  } catch (e) {
    if (
      e.code === 'MODULE_NOT_FOUND' &&
      (modulePath === 'buildscale-cloud' || modulePath === '@nrwl/buildscale-cloud')
    ) {
      return require('../buildscale-cloud/buildscale-cloud-tasks-runner-shell')
        .buildscaleCloudTasksRunnerShell;
    }
    throw e;
  }
}

export function getRunner(
  buildscaleArgs: BuildscaleArgs,
  buildscaleJson: BuildscaleJsonConfiguration
): {
  tasksRunner: TasksRunner;
  runnerOptions: any;
} {
  let runner = buildscaleArgs.runner;
  runner = runner || 'default';

  if (runner !== 'default' && !buildscaleJson.tasksRunnerOptions?.[runner]) {
    throw new Error(`Could not find runner configuration for ${runner}`);
  }

  const modulePath: string = getTasksRunnerPath(runner, buildscaleJson);

  try {
    const tasksRunner = loadTasksRunner(modulePath);

    return {
      tasksRunner,
      runnerOptions: getRunnerOptions(
        runner,
        buildscaleJson,
        buildscaleArgs,
        modulePath === 'buildscale-cloud'
      ),
    };
  } catch {
    throw new Error(`Could not find runner configuration for ${runner}`);
  }
}
function getTasksRunnerPath(
  runner: string,
  buildscaleJson: BuildscaleJsonConfiguration<string[] | '*'>
) {
  let modulePath: string = buildscaleJson.tasksRunnerOptions?.[runner]?.runner;

  if (modulePath) {
    if (isRelativePath(modulePath)) {
      return join(workspaceRoot, modulePath);
    }
    return modulePath;
  }

  const isCloudRunner =
    // No tasksRunnerOptions for given --runner
    buildscaleJson.buildscaleCloudAccessToken ||
    // No runner prop in tasks runner options, check if access token is set.
    buildscaleJson.tasksRunnerOptions?.[runner]?.options?.accessToken ||
    // Cloud access token specified in env var.
    process.env.BUILDSCALE_CLOUD_ACCESS_TOKEN;

  return isCloudRunner ? 'buildscale-cloud' : require.resolve('./default-tasks-runner');
}

export function getRunnerOptions(
  runner: string,
  buildscaleJson: BuildscaleJsonConfiguration<string[] | '*'>,
  buildscaleArgs: BuildscaleArgs,
  isCloudDefault: boolean
): any {
  const defaultCacheableOperations = [];

  for (const key in buildscaleJson.targetDefaults) {
    if (buildscaleJson.targetDefaults[key].cache) {
      defaultCacheableOperations.push(key);
    }
  }

  const result = {
    ...buildscaleJson.tasksRunnerOptions?.[runner]?.options,
    ...buildscaleArgs,
  };

  // NOTE: we don't pull from env here because the cloud package
  // supports it within buildscale-cloud's implementation. We could
  // normalize it here, and that may make more sense, but
  // leaving it as is for now.
  if (buildscaleJson.buildscaleCloudAccessToken && isCloudDefault) {
    result.accessToken ??= buildscaleJson.buildscaleCloudAccessToken;
  }

  if (buildscaleJson.buildscaleCloudUrl && isCloudDefault) {
    result.url ??= buildscaleJson.buildscaleCloudUrl;
  }

  if (buildscaleJson.buildscaleCloudEncryptionKey && isCloudDefault) {
    result.encryptionKey ??= buildscaleJson.buildscaleCloudEncryptionKey;
  }

  if (buildscaleJson.parallel) {
    result.parallel ??= buildscaleJson.parallel;
  }

  if (buildscaleJson.cacheDirectory) {
    result.cacheDirectory ??= buildscaleJson.cacheDirectory;
  }

  if (defaultCacheableOperations.length) {
    result.cacheableOperations ??= [];
    result.cacheableOperations = result.cacheableOperations.concat(
      defaultCacheableOperations
    );
  }

  if (buildscaleJson.useDaemonProcess !== undefined) {
    result.useDaemonProcess ??= buildscaleJson.useDaemonProcess;
  }

  return result;
}
