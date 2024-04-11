import { BuildscaleJsonConfiguration } from '../config/buildscale-json';
import { ProjectGraph } from '../config/project-graph';
import { Task, TaskGraph } from '../config/task-graph';
import { BuildscaleArgs } from '../utils/command-line-utils';
import { TaskHasher } from '../hasher/task-hasher';
import { DaemonClient } from '../daemon/client/client';

export type TaskStatus =
  | 'success'
  | 'failure'
  | 'skipped'
  | 'local-cache-kept-existing'
  | 'local-cache'
  | 'remote-cache';

/**
 * `any | Promise<{ [id: string]: TaskStatus }>`
 * will change to Promise<{ [id: string]: TaskStatus }> after Buildscale 15 is released.
 */
export type TasksRunner<T = unknown> = (
  tasks: Task[],
  options: T,
  context?: {
    target?: string;
    initiatingProject?: string | null;
    projectGraph: ProjectGraph;
    buildscaleJson: BuildscaleJsonConfiguration;
    buildscaleArgs: BuildscaleArgs;
    taskGraph?: TaskGraph;
    hasher?: TaskHasher;
    daemon?: DaemonClient;
  }
) => any | Promise<{ [id: string]: TaskStatus }>;
