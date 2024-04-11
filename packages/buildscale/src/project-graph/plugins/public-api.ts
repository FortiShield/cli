// This file represents the public API for plugins which live in buildscale.json's plugins array.
// For methods to interact with plugins from within Buildscale. see `./internal-api.ts`.

import { BuildscalePluginV1 } from '../../utils/buildscale-plugin.deprecated';
import {
  FileMap,
  ProjectGraph,
  ProjectGraphExternalNode,
} from '../../config/project-graph';

import { ProjectConfiguration } from '../../config/workspace-json-project-json';

import { BuildscaleJsonConfiguration } from '../../config/buildscale-json';
import { RawProjectGraphDependency } from '../project-graph-builder';

/**
 * Context for {@link CreateNodesFunction}
 */
export interface CreateNodesContext {
  readonly buildscaleJsonConfiguration: BuildscaleJsonConfiguration;
  readonly workspaceRoot: string;
  /**
   * The subset of configuration files which match the createNodes pattern
   */
  readonly configFiles: string[];
}

/**
 * A function which parses a configuration file into a set of nodes.
 * Used for creating nodes for the {@link ProjectGraph}
 */
export type CreateNodesFunction<T = unknown> = (
  projectConfigurationFile: string,
  options: T | undefined,
  context: CreateNodesContext
) => CreateNodesResult | Promise<CreateNodesResult>;

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export interface CreateNodesResult {
  /**
   * A map of project root -> project configuration
   */
  projects?: Record<string, Optional<ProjectConfiguration, 'root'>>;

  /**
   * A map of external node name -> external node. External nodes do not have a root, so the key is their name.
   */
  externalNodes?: Record<string, ProjectGraphExternalNode>;
}

/**
 * A pair of file patterns and {@link CreateNodesFunction}
 */
export type CreateNodes<T = unknown> = readonly [
  projectFilePattern: string,
  createNodesFunction: CreateNodesFunction<T>
];

/**
 * Context for {@link CreateDependencies}
 */
export interface CreateDependenciesContext {
  /**
   * The external nodes that have been added to the graph.
   */
  readonly externalNodes: ProjectGraph['externalNodes'];

  /**
   * The configuration of each project in the workspace.
   */
  readonly projects: Record<string, ProjectConfiguration>;

  /**
   * The `buildscale.json` configuration from the workspace
   */
  readonly buildscaleJsonConfiguration: BuildscaleJsonConfiguration;

  /**
   * All files in the workspace
   */
  readonly fileMap: FileMap;

  /**
   * Files changes since last invocation
   */
  readonly filesToProcess: FileMap;

  readonly workspaceRoot: string;
}

/**
 * A function which parses files in the workspace to create dependencies in the {@link ProjectGraph}
 * Use {@link validateDependency} to validate dependencies
 */
export type CreateDependencies<T = unknown> = (
  options: T | undefined,
  context: CreateDependenciesContext
) => RawProjectGraphDependency[] | Promise<RawProjectGraphDependency[]>;

/**
 * A plugin for Buildscale which creates nodes and dependencies for the {@link ProjectGraph}
 */
export type BuildscalePluginV2<TOptions = unknown> = {
  name: string;

  /**
   * Provides a file pattern and function that retrieves configuration info from
   * those files. e.g. { '**\/*.csproj': buildProjectsFromCsProjFile }
   */
  createNodes?: CreateNodes<TOptions>;

  // Todo(@AgentEnder): This shouldn't be a full processor, since its only responsible for defining edges between projects. What do we want the API to be?
  /**
   * Provides a function to analyze files to create dependencies for the {@link ProjectGraph}
   */
  createDependencies?: CreateDependencies<TOptions>;
};

/**
 * A plugin for Buildscale
 */
export type BuildscalePlugin = BuildscalePluginV1 | BuildscalePluginV2;
