import {
  readFileMapCache,
  readProjectGraphCache,
  writeCache,
} from './buildscale-deps-cache';
import {
  CreateDependenciesError,
  ProcessDependenciesError,
  ProcessProjectGraphError,
  buildProjectGraphUsingProjectFileMap,
} from './build-project-graph';
import { output } from '../utils/output';
import { markDaemonAsDisabled, writeDaemonLogs } from '../daemon/tmp-dir';
import { ProjectGraph } from '../config/project-graph';
import { stripIndents } from '../utils/strip-indents';
import {
  ProjectConfiguration,
  ProjectsConfigurations,
} from '../config/workspace-json-project-json';
import { daemonClient } from '../daemon/client/client';
import { fileExists } from '../utils/fileutils';
import { workspaceRoot } from '../utils/workspace-root';
import { performance } from 'perf_hooks';
import {
  retrieveProjectConfigurations,
  retrieveWorkspaceFiles,
} from './utils/retrieve-workspace-files';
import { readBuildscaleJson } from '../config/buildscale-json';
import {
  ConfigurationResult,
  ConfigurationSourceMaps,
} from './utils/project-configuration-utils';
import {
  CreateNodesError,
  MergeNodesError,
  ProjectConfigurationsError,
} from './error-types';
import { DaemonProjectGraphError } from '../daemon/daemon-project-graph-error';
import { loadBuildscalePlugins, LoadedBuildscalePlugin } from './plugins/internal-api';

/**
 * Synchronously reads the latest cached copy of the workspace's ProjectGraph.
 * @throws {Error} if there is no cached ProjectGraph to read from
 */
export function readCachedProjectGraph(): ProjectGraph {
  const projectGraphCache: ProjectGraph = readProjectGraphCache();
  if (!projectGraphCache) {
    const angularSpecificError = fileExists(`${workspaceRoot}/angular.json`)
      ? stripIndents`
      Make sure invoke 'node ./decorate-angular-cli.js' in your postinstall script.
      The decorated CLI will compute the project graph.
      'ng --help' should say 'Smart Monorepos · Fast CI'.
      `
      : '';

    throw new Error(stripIndents`
      [readCachedProjectGraph] ERROR: No cached ProjectGraph is available.

      If you are leveraging \`readCachedProjectGraph()\` directly then you will need to refactor your usage to first ensure that
      the ProjectGraph is created by calling \`await createProjectGraphAsync()\` somewhere before attempting to read the data.

      If you encounter this error as part of running standard \`buildscale\` commands then please open an issue on https://github.com/buildscale/cli

      ${angularSpecificError}
    `);
  }
  return projectGraphCache;
}

export function readCachedProjectConfiguration(
  projectName: string
): ProjectConfiguration {
  const graph = readCachedProjectGraph();
  const node = graph.nodes[projectName];
  try {
    return node.data;
  } catch (e) {
    throw new Error(`Cannot find project: '${projectName}' in your workspace.`);
  }
}

/**
 * Get the {@link ProjectsConfigurations} from the {@link ProjectGraph}
 */
export function readProjectsConfigurationFromProjectGraph(
  projectGraph: ProjectGraph
): ProjectsConfigurations {
  return {
    projects: Object.fromEntries(
      Object.entries(projectGraph.nodes).map(([project, { data }]) => [
        project,
        data,
      ])
    ),
    version: 2,
  };
}

export async function buildProjectGraphAndSourceMapsWithoutDaemon() {
  global.BUILDSCALE_GRAPH_CREATION = true;
  const buildscaleJson = readBuildscaleJson();

  performance.mark('retrieve-project-configurations:start');
  let configurationResult: ConfigurationResult;
  let projectConfigurationsError: ProjectConfigurationsError;
  const [plugins, cleanup] = await loadBuildscalePlugins(buildscaleJson.plugins);
  try {
    configurationResult = await retrieveProjectConfigurations(
      plugins,
      workspaceRoot,
      buildscaleJson
    );
  } catch (e) {
    if (e instanceof ProjectConfigurationsError) {
      projectConfigurationsError = e;
      configurationResult = e.partialProjectConfigurationsResult;
    } else {
      throw e;
    }
  }
  const { projects, externalNodes, sourceMaps, projectRootMap } =
    configurationResult;
  performance.mark('retrieve-project-configurations:end');

  performance.mark('retrieve-workspace-files:start');
  const { allWorkspaceFiles, fileMap, rustReferences } =
    await retrieveWorkspaceFiles(workspaceRoot, projectRootMap);
  performance.mark('retrieve-workspace-files:end');

  const cacheEnabled = process.env.BUILDSCALE_CACHE_PROJECT_GRAPH !== 'false';
  performance.mark('build-project-graph-using-project-file-map:start');
  let createDependenciesError: CreateDependenciesError;
  let projectGraphResult: Awaited<
    ReturnType<typeof buildProjectGraphUsingProjectFileMap>
  >;
  try {
    projectGraphResult = await buildProjectGraphUsingProjectFileMap(
      projects,
      externalNodes,
      fileMap,
      allWorkspaceFiles,
      rustReferences,
      cacheEnabled ? readFileMapCache() : null,
      plugins
    );
  } catch (e) {
    if (e instanceof CreateDependenciesError) {
      projectGraphResult = {
        projectGraph: e.partialProjectGraph,
        projectFileMapCache: null,
      };
      createDependenciesError = e;
    } else {
      throw e;
    }
  } finally {
    cleanup();
  }

  const { projectGraph, projectFileMapCache } = projectGraphResult;
  performance.mark('build-project-graph-using-project-file-map:end');

  delete global.BUILDSCALE_GRAPH_CREATION;

  const errors = [
    ...(projectConfigurationsError?.errors ?? []),
    ...(createDependenciesError?.errors ?? []),
  ];

  if (errors.length > 0) {
    throw new ProjectGraphError(errors, projectGraph, sourceMaps);
  } else {
    if (cacheEnabled) {
      writeCache(projectFileMapCache, projectGraph);
    }
    return { projectGraph, sourceMaps };
  }
}

export class ProjectGraphError extends Error {
  readonly #errors: Array<
    CreateNodesError | ProcessDependenciesError | ProcessProjectGraphError
  >;
  readonly #partialProjectGraph: ProjectGraph;
  readonly #partialSourceMaps: ConfigurationSourceMaps;

  constructor(
    errors: Array<
      | CreateNodesError
      | MergeNodesError
      | ProcessDependenciesError
      | ProcessProjectGraphError
    >,
    partialProjectGraph: ProjectGraph,
    partialSourceMaps: ConfigurationSourceMaps
  ) {
    super(`Failed to process project graph.`);
    this.name = this.constructor.name;
    this.#errors = errors;
    this.#partialProjectGraph = partialProjectGraph;
    this.#partialSourceMaps = partialSourceMaps;
    this.stack = `${this.message}\n  ${errors
      .map((error) => error.stack.split('\n').join('\n  '))
      .join('\n')}`;
  }

  /**
   * The daemon cannot throw errors which contain methods as they are not serializable.
   *
   * This method creates a new {@link ProjectGraphError} from a {@link DaemonProjectGraphError} with the methods based on the same serialized data.
   */
  static fromDaemonProjectGraphError(e: DaemonProjectGraphError) {
    return new ProjectGraphError(e.errors, e.projectGraph, e.sourceMaps);
  }

  /**
   * This gets the partial project graph despite the errors which occured.
   * This partial project graph may be missing nodes, properties of nodes, or dependencies.
   * This is useful mostly for visualization/debugging. It should not be used for running tasks.
   */
  getPartialProjectGraph() {
    return this.#partialProjectGraph;
  }

  getPartialSourcemaps() {
    return this.#partialSourceMaps;
  }

  getErrors() {
    return this.#errors;
  }
}

function handleProjectGraphError(opts: { exitOnError: boolean }, e) {
  if (opts.exitOnError) {
    const isVerbose = process.env.BUILDSCALE_VERBOSE_LOGGING === 'true';
    if (e instanceof ProjectGraphError) {
      let title = e.message;
      if (isVerbose) {
        title += ' See errors below.';
      }

      const bodyLines = isVerbose
        ? [e.stack]
        : ['Pass --verbose to see the stacktraces.'];

      output.error({
        title,
        bodyLines: bodyLines,
      });
    } else {
      const lines = e.message.split('\n');
      output.error({
        title: lines[0],
        bodyLines: lines.slice(1),
      });
      if (isVerbose) {
        console.error(e);
      }
    }
    process.exit(1);
  } else {
    throw e;
  }
}

/**
 * Computes and returns a ProjectGraph.
 *
 * Buildscale will compute the graph either in a daemon process or in the current process.
 *
 * Buildscale will compute it in the current process if:
 * * The process is running in CI (CI env variable is to true or other common variables used by CI providers are set).
 * * It is running in the docker container.
 * * The daemon process is disabled because of the previous error when starting the daemon.
 * * `BUILDSCALE_DAEMON` is set to `false`.
 * * `useDaemonProcess` is set to false in the options of the tasks runner inside `buildscale.json`
 *
 * `BUILDSCALE_DAEMON` env variable takes precedence:
 * * If it is set to true, the daemon will always be used.
 * * If it is set to false, the graph will always be computed in the current process.
 *
 * Tip: If you want to debug project graph creation, run your command with BUILDSCALE_DAEMON=false.
 *
 * Buildscale uses two layers of caching: the information about explicit dependencies stored on the disk and the information
 * stored in the daemon process. To reset both run: `buildscale reset`.
 */
export async function createProjectGraphAsync(
  opts: { exitOnError: boolean; resetDaemonClient?: boolean } = {
    exitOnError: false,
    resetDaemonClient: false,
  }
): Promise<ProjectGraph> {
  const projectGraphAndSourceMaps = await createProjectGraphAndSourceMapsAsync(
    opts
  );
  return projectGraphAndSourceMaps.projectGraph;
}

export async function createProjectGraphAndSourceMapsAsync(
  opts: { exitOnError: boolean; resetDaemonClient?: boolean } = {
    exitOnError: false,
    resetDaemonClient: false,
  }
) {
  performance.mark('create-project-graph-async:start');

  if (!daemonClient.enabled()) {
    try {
      const res = await buildProjectGraphAndSourceMapsWithoutDaemon();
      performance.measure(
        'create-project-graph-async >> retrieve-project-configurations',
        'retrieve-project-configurations:start',
        'retrieve-project-configurations:end'
      );
      performance.measure(
        'create-project-graph-async >> retrieve-workspace-files',
        'retrieve-workspace-files:start',
        'retrieve-workspace-files:end'
      );
      performance.measure(
        'create-project-graph-async >> build-project-graph-using-project-file-map',
        'build-project-graph-using-project-file-map:start',
        'build-project-graph-using-project-file-map:end'
      );
      performance.mark('create-project-graph-async:end');
      performance.measure(
        'create-project-graph-async',
        'create-project-graph-async:start',
        'create-project-graph-async:end'
      );
      return res;
    } catch (e) {
      handleProjectGraphError(opts, e);
    }
  } else {
    try {
      const projectGraphAndSourceMaps =
        await daemonClient.getProjectGraphAndSourceMaps();
      performance.mark('create-project-graph-async:end');
      performance.measure(
        'create-project-graph-async',
        'create-project-graph-async:start',
        'create-project-graph-async:end'
      );
      return projectGraphAndSourceMaps;
    } catch (e) {
      if (e.message.indexOf('inotify_add_watch') > -1) {
        // common errors with the daemon due to OS settings (cannot watch all the files available)
        output.note({
          title: `Unable to start Buildscale Daemon due to the limited amount of inotify watches, continuing without the daemon.`,
          bodyLines: [
            'For more information read: https://askubuntu.com/questions/1088272/inotify-add-watch-failed-no-space-left-on-device',
            'Buildscale Daemon is going to be disabled until you run "buildscale reset".',
          ],
        });
        markDaemonAsDisabled();
        return buildProjectGraphAndSourceMapsWithoutDaemon();
      }

      if (e.internalDaemonError) {
        const errorLogFile = writeDaemonLogs(e.message);
        output.warn({
          title: `Buildscale Daemon was not able to compute the project graph.`,
          bodyLines: [
            `Log file with the error: ${errorLogFile}`,
            `Please file an issue at https://github.com/buildscale/cli`,
            'Buildscale Daemon is going to be disabled until you run "buildscale reset".',
          ],
        });
        markDaemonAsDisabled();
        return buildProjectGraphAndSourceMapsWithoutDaemon();
      }

      handleProjectGraphError(opts, e);
    } finally {
      if (opts.resetDaemonClient) {
        daemonClient.reset();
      }
    }
  }
}
