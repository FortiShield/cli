import { getCommandAsString } from '../../tasks-runner/utils';
import * as yargs from 'yargs';
import type { BuildscaleArgs } from '../../utils/command-line-utils';
import {
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../../config/project-graph';
import {
  createTaskGraph,
  mapTargetDefaultsToDependencies,
} from '../../tasks-runner/create-task-graph';
import { BuildscaleJsonConfiguration } from '../../config/buildscale-json';
import {
  DaemonBasedTaskHasher,
  InProcessTaskHasher,
  TaskHasher,
} from '../../hasher/task-hasher';
import { hashTask } from '../../hasher/hash-task';
import { getPackageManagerCommand } from '../../utils/package-manager';
import { printAffectedDeprecationMessage } from './command-object';
import { logger, BUILDSCALE_PREFIX } from '../../utils/logger';
import { getTaskSpecificEnv } from '../../tasks-runner/task-env';
import { getFileMap } from '../../project-graph/build-project-graph';
import { daemonClient } from '../../daemon/client/client';

/**
 * @deprecated Use showProjectsHandler, generateGraph, or affected (without the print-affected mode) instead.
 */
export async function printAffected(
  affectedProjects: ProjectGraphProjectNode[],
  projectGraph: ProjectGraph,
  { buildscaleJson }: { buildscaleJson: BuildscaleJsonConfiguration },
  buildscaleArgs: BuildscaleArgs,
  overrides: yargs.Arguments
) {
  logger.warn([BUILDSCALE_PREFIX, printAffectedDeprecationMessage].join(' '));
  const projectsForType = affectedProjects.filter((p) =>
    buildscaleArgs.type ? p.type === buildscaleArgs.type : true
  );
  const projectNames = projectsForType.map((p) => p.name);
  const tasksJson =
    buildscaleArgs.targets && buildscaleArgs.targets.length > 0
      ? await createTasks(
          projectsForType,
          projectGraph,
          buildscaleArgs,
          buildscaleJson,
          overrides
        )
      : [];
  const result = {
    tasks: tasksJson,
    projects: projectNames,
    projectGraph: serializeProjectGraph(projectGraph),
  };
  if (buildscaleArgs.select) {
    console.log(selectPrintAffected(result, buildscaleArgs.select));
  } else {
    console.log(JSON.stringify(selectPrintAffected(result, null), null, 2));
  }
}

async function createTasks(
  affectedProjectsWithTargetAndConfig: ProjectGraphProjectNode[],
  projectGraph: ProjectGraph,
  buildscaleArgs: BuildscaleArgs,
  buildscaleJson: BuildscaleJsonConfiguration,
  overrides: yargs.Arguments
) {
  const defaultDependencyConfigs = mapTargetDefaultsToDependencies(
    buildscaleJson.targetDefaults
  );
  const taskGraph = createTaskGraph(
    projectGraph,
    defaultDependencyConfigs,
    affectedProjectsWithTargetAndConfig.map((p) => p.name),
    buildscaleArgs.targets,
    buildscaleArgs.configuration,
    overrides
  );

  let hasher: TaskHasher;
  if (daemonClient.enabled()) {
    hasher = new DaemonBasedTaskHasher(daemonClient, {});
  } else {
    const { fileMap, allWorkspaceFiles, rustReferences } = getFileMap();
    hasher = new InProcessTaskHasher(
      fileMap?.projectFileMap,
      allWorkspaceFiles,
      projectGraph,
      buildscaleJson,
      rustReferences,
      {}
    );
  }

  const execCommand = getPackageManagerCommand().exec;
  const tasks = Object.values(taskGraph.tasks);

  await Promise.all(
    tasks.map((t) =>
      hashTask(
        hasher,
        projectGraph,
        taskGraph,
        t,
        // This loads dotenv files for the task
        getTaskSpecificEnv(t)
      )
    )
  );

  return tasks.map((task) => ({
    id: task.id,
    overrides,
    target: task.target,
    hash: task.hash,
    command: getCommandAsString(execCommand, task),
    outputs: task.outputs,
  }));
}

function serializeProjectGraph(projectGraph: ProjectGraph) {
  const nodes = Object.values(projectGraph.nodes).map((n) => n.name);
  const dependencies = {};
  // we don't need external dependencies' dependencies for print-affected
  // having them included makes the output unreadable
  Object.keys(projectGraph.dependencies).forEach((key) => {
    if (!key.startsWith('npm:')) {
      dependencies[key] = projectGraph.dependencies[key];
    }
  });
  return { nodes, dependencies };
}

export function selectPrintAffected(wholeJson: any, wholeSelect: string) {
  if (!wholeSelect) return wholeJson;
  return _select(wholeJson, wholeSelect);

  function _select(json: any, select: string) {
    if (select.indexOf('.') > -1) {
      const [firstKey, ...restKeys] = select.split('.');
      const first = json[firstKey];
      throwIfEmpty(wholeSelect, first);
      const rest = restKeys.join('.');

      if (Array.isArray(first)) {
        return first.map((q) => _select(q, rest)).join(', ');
      } else {
        return _select(first, rest);
      }
    } else {
      const res = json[select];
      throwIfEmpty(wholeSelect, res);
      if (Array.isArray(res)) {
        return res.join(', ');
      } else {
        return res;
      }
    }
  }
}

function throwIfEmpty(select: string, value: any) {
  if (value === undefined) {
    throw new Error(
      `Cannot select '${select}' in the results of print-affected.`
    );
  }
}
