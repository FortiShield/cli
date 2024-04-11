import { runCommand } from '../../tasks-runner/run-command';
import {
  BuildscaleArgs,
  readGraphFileFromGraphArg,
} from '../../utils/command-line-utils';
import { splitArgsIntoBuildscaleArgsAndOverrides } from '../../utils/command-line-utils';
import { projectHasTarget } from '../../utils/project-graph-utils';
import { connectToBuildscaleCloudIfExplicitlyAsked } from '../connect/connect-to-buildscale-cloud';
import { performance } from 'perf_hooks';
import {
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../../config/project-graph';
import { createProjectGraphAsync } from '../../project-graph/project-graph';
import { TargetDependencyConfig } from '../../config/workspace-json-project-json';
import { readBuildscaleJson } from '../../config/configuration';
import { output } from '../../utils/output';
import { findMatchingProjects } from '../../utils/find-matching-projects';
import { workspaceConfigurationCheck } from '../../utils/workspace-configuration-check';
import { generateGraph } from '../graph/graph';

export async function runMany(
  args: { [k: string]: any },
  extraTargetDependencies: Record<
    string,
    (TargetDependencyConfig | string)[]
  > = {},
  extraOptions = { excludeTaskDependencies: false, loadDotEnvFiles: true } as {
    excludeTaskDependencies: boolean;
    loadDotEnvFiles: boolean;
  }
) {
  performance.mark('code-loading:end');
  performance.measure('code-loading', 'init-local', 'code-loading:end');
  workspaceConfigurationCheck();
  const buildscaleJson = readBuildscaleJson();
  const { buildscaleArgs, overrides } = splitArgsIntoBuildscaleArgsAndOverrides(
    args,
    'run-many',
    { printWarnings: args.graph !== 'stdout' },
    buildscaleJson
  );
  if (buildscaleArgs.verbose) {
    process.env.BUILDSCALE_VERBOSE_LOGGING = 'true';
  }

  await connectToBuildscaleCloudIfExplicitlyAsked(buildscaleArgs);

  const projectGraph = await createProjectGraphAsync({ exitOnError: true });
  const projects = projectsToRun(buildscaleArgs, projectGraph);

  if (buildscaleArgs.graph) {
    const file = readGraphFileFromGraphArg(buildscaleArgs);
    const projectNames = projects.map((t) => t.name);
    return await generateGraph(
      {
        watch: false,
        open: true,
        view: 'tasks',
        all: buildscaleArgs.all,
        targets: buildscaleArgs.targets,
        projects: projectNames,
        file,
      },
      projectNames
    );
  } else {
    const status = await runCommand(
      projects,
      projectGraph,
      { buildscaleJson },
      buildscaleArgs,
      overrides,
      null,
      extraTargetDependencies,
      extraOptions
    );
    process.exit(status);
  }
}

export function projectsToRun(
  buildscaleArgs: BuildscaleArgs,
  projectGraph: ProjectGraph
): ProjectGraphProjectNode[] {
  const selectedProjects: Record<string, ProjectGraphProjectNode> = {};
  const validProjects = runnableForTarget(projectGraph.nodes, buildscaleArgs.targets);
  const invalidProjects: string[] = [];

  // --all is default now, if --projects is provided, it'll override the --all
  if (buildscaleArgs.all && buildscaleArgs.projects.length === 0) {
    for (const projectName of validProjects) {
      selectedProjects[projectName] = projectGraph.nodes[projectName];
    }
  } else {
    const matchingProjects = findMatchingProjects(
      buildscaleArgs.projects,
      projectGraph.nodes
    );
    for (const project of matchingProjects) {
      if (!validProjects.has(project)) {
        invalidProjects.push(project);
      } else {
        selectedProjects[project] = projectGraph.nodes[project];
      }
    }

    if (invalidProjects.length > 0) {
      output.warn({
        title: `The following projects do not have a configuration for any of the provided targets ("${buildscaleArgs.targets.join(
          ', '
        )}")`,
        bodyLines: invalidProjects.map((name) => `- ${name}`),
      });
    }
  }

  const excludedProjects = findMatchingProjects(
    buildscaleArgs.exclude,
    selectedProjects
  );

  for (const excludedProject of excludedProjects) {
    delete selectedProjects[excludedProject];
  }

  return Object.values(selectedProjects);
}

function runnableForTarget(
  projects: Record<string, ProjectGraphProjectNode>,
  targets: string[]
): Set<string> {
  const runnable = new Set<string>();
  for (let projectName in projects) {
    const project = projects[projectName];
    if (targets.find((target) => projectHasTarget(project, target))) {
      runnable.add(projectName);
    }
  }
  return runnable;
}
