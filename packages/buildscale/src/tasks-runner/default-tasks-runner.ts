import { TasksRunner, TaskStatus } from './tasks-runner';
import { TaskOrchestrator } from './task-orchestrator';
import { TaskHasher } from '../hasher/task-hasher';
import { LifeCycle } from './life-cycle';
import { ProjectGraph } from '../config/project-graph';
import { BuildscaleJsonConfiguration } from '../config/buildscale-json';
import { Task, TaskGraph } from '../config/task-graph';
import { BuildscaleArgs } from '../utils/command-line-utils';
import { DaemonClient } from '../daemon/client/client';

export interface RemoteCache {
  retrieve: (hash: string, cacheDirectory: string) => Promise<boolean>;
  store: (hash: string, cacheDirectory: string) => Promise<boolean>;
}

export interface DefaultTasksRunnerOptions {
  parallel?: number;
  cacheableOperations?: string[];
  cacheableTargets?: string[];
  runtimeCacheInputs?: string[];
  cacheDirectory?: string;
  remoteCache?: RemoteCache;
  lifeCycle: LifeCycle;
  captureStderr?: boolean;
  skipBuildscaleCache?: boolean;
  batch?: boolean;
}

export const defaultTasksRunner: TasksRunner<
  DefaultTasksRunnerOptions
> = async (
  tasks: Task[],
  options: DefaultTasksRunnerOptions,
  context: {
    target: string;
    initiatingProject?: string;
    projectGraph: ProjectGraph;
    buildscaleJson: BuildscaleJsonConfiguration;
    buildscaleArgs: BuildscaleArgs;
    taskGraph: TaskGraph;
    hasher: TaskHasher;
    daemon: DaemonClient;
  }
): Promise<{ [id: string]: TaskStatus }> => {
  if (
    (options as any)['parallel'] === 'false' ||
    (options as any)['parallel'] === false
  ) {
    (options as any)['parallel'] = 1;
  } else if (
    (options as any)['parallel'] === 'true' ||
    (options as any)['parallel'] === true ||
    (options as any)['parallel'] === undefined ||
    (options as any)['parallel'] === ''
  ) {
    (options as any)['parallel'] = Number((options as any)['maxParallel'] || 3);
  }

  options.lifeCycle.startCommand();
  try {
    return await runAllTasks(tasks, options, context);
  } finally {
    options.lifeCycle.endCommand();
  }
};

async function runAllTasks(
  tasks: Task[],
  options: DefaultTasksRunnerOptions,
  context: {
    initiatingProject?: string;
    projectGraph: ProjectGraph;
    buildscaleJson: BuildscaleJsonConfiguration;
    buildscaleArgs: BuildscaleArgs;
    taskGraph: TaskGraph;
    hasher: TaskHasher;
    daemon: DaemonClient;
  }
): Promise<{ [id: string]: TaskStatus }> {
  const orchestrator = new TaskOrchestrator(
    context.hasher,
    context.initiatingProject,
    context.projectGraph,
    context.taskGraph,
    options,
    context.buildscaleArgs?.buildscaleBail,
    context.daemon
  );

  return orchestrator.run();
}

export default defaultTasksRunner;
