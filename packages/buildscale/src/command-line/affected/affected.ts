import { calculateFileChanges } from '../../project-graph/file-utils';
import { runCommand } from '../../tasks-runner/run-command';
import { output } from '../../utils/output';
import { printAffected } from './print-affected';
import { connectToBuildscaleCloudIfExplicitlyAsked } from '../connect/connect-to-buildscale-cloud';
import type { BuildscaleArgs } from '../../utils/command-line-utils';
import {
  parseFiles,
  readGraphFileFromGraphArg,
  splitArgsIntoBuildscaleArgsAndOverrides,
} from '../../utils/command-line-utils';
import { performance } from 'perf_hooks';
import { createProjectGraphAsync } from '../../project-graph/project-graph';
import {
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../../config/project-graph';
import { projectHasTarget } from '../../utils/project-graph-utils';
import { filterAffected } from '../../project-graph/affected/affected-project-graph';
import { TargetDependencyConfig } from '../../config/workspace-json-project-json';
import { readBuildscaleJson } from '../../config/configuration';
import { workspaceConfigurationCheck } from '../../utils/workspace-configuration-check';
import { findMatchingProjects } from '../../utils/find-matching-projects';
import { generateGraph } from '../graph/graph';
import { allFileData } from '../../utils/all-file-data';
import { BUILDSCALE_PREFIX, logger } from '../../utils/logger';
import { affectedGraphDeprecationMessage } from './command-object';

export async function affected(
  command: 'graph' | 'print-affected' | 'affected',
  args: { [k: string]: any },
  extraTargetDependencies: Record<
    string,
    (TargetDependencyConfig | string)[]
  > = {}
): Promise<void> {
  performance.mark('code-loading:end');
  performance.measure('code-loading', 'init-local', 'code-loading:end');
  workspaceConfigurationCheck();

  const buildscaleJson = readBuildscaleJson();
  const { buildscaleArgs, overrides } = splitArgsIntoBuildscaleArgsAndOverrides(
    args,
    'affected',
    {
      printWarnings:
        command !== 'print-affected' && !args.plain && args.graph !== 'stdout',
    },
    buildscaleJson
  );

  if (buildscaleArgs.verbose) {
    process.env.BUILDSCALE_VERBOSE_LOGGING = 'true';
  }

  await connectToBuildscaleCloudIfExplicitlyAsked(buildscaleArgs);

  const projectGraph = await createProjectGraphAsync({ exitOnError: true });
  const projects = await getAffectedGraphNodes(buildscaleArgs, projectGraph);

  try {
    switch (command) {
      case 'graph':
        logger.warn([BUILDSCALE_PREFIX, affectedGraphDeprecationMessage].join(' '));
        const projectNames = projects.map((p) => p.name);
        await generateGraph(args as any, projectNames);
        break;

      case 'print-affected':
        if (buildscaleArgs.targets && buildscaleArgs.targets.length > 0) {
          await printAffected(
            allProjectsWithTarget(projects, buildscaleArgs),
            projectGraph,
            { buildscaleJson },
            buildscaleArgs,
            overrides
          );
        } else {
          await printAffected(
            projects,
            projectGraph,
            { buildscaleJson },
            buildscaleArgs,
            overrides
          );
        }
        break;

      case 'affected': {
        const projectsWithTarget = allProjectsWithTarget(projects, buildscaleArgs);
        if (buildscaleArgs.graph) {
          const projectNames = projectsWithTarget.map((t) => t.name);
          const file = readGraphFileFromGraphArg(buildscaleArgs);

          return await generateGraph(
            {
              watch: false,
              open: true,
              view: 'tasks',
              targets: buildscaleArgs.targets,
              projects: projectNames,
              file,
            },
            projectNames
          );
        } else {
          const status = await runCommand(
            projectsWithTarget,
            projectGraph,
            { buildscaleJson },
            buildscaleArgs,
            overrides,
            null,
            extraTargetDependencies,
            { excludeTaskDependencies: false, loadDotEnvFiles: true }
          );
          process.exit(status);
        }
        break;
      }
    }
    await output.drain();
  } catch (e) {
    printError(e, args.verbose);
    process.exit(1);
  }
}

export async function getAffectedGraphNodes(
  buildscaleArgs: BuildscaleArgs,
  projectGraph: ProjectGraph
): Promise<ProjectGraphProjectNode[]> {
  let affectedGraph = buildscaleArgs.all
    ? projectGraph
    : await filterAffected(
        projectGraph,
        calculateFileChanges(
          parseFiles(buildscaleArgs).files,
          await allFileData(),
          buildscaleArgs
        )
      );

  if (buildscaleArgs.exclude) {
    const excludedProjects = new Set(
      findMatchingProjects(buildscaleArgs.exclude, affectedGraph.nodes)
    );

    return Object.entries(affectedGraph.nodes)
      .filter(([projectName]) => !excludedProjects.has(projectName))
      .map(([, project]) => project);
  }

  return Object.values(affectedGraph.nodes);
}

function allProjectsWithTarget(
  projects: ProjectGraphProjectNode[],
  buildscaleArgs: BuildscaleArgs
) {
  return projects.filter((p) =>
    buildscaleArgs.targets.find((target) => projectHasTarget(p, target))
  );
}

function printError(e: any, verbose?: boolean) {
  const bodyLines = [e.message];
  if (verbose && e.stack) {
    bodyLines.push('');
    bodyLines.push(e.stack);
  }
  output.error({
    title: 'There was a critical error when running your command',
    bodyLines,
  });
}
