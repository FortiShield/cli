import { shouldMergeAngularProjects } from '../adapter/angular-json';
import { ProjectGraphProcessor } from '../config/project-graph';
import { TargetConfiguration } from '../config/workspace-json-project-json';
import ProjectJsonProjectsPlugin from '../plugins/project-json/build-nodes/project-json';
import TargetDefaultsPlugin from '../plugins/target-defaults/target-defaults-plugin';
import * as PackageJsonWorkspacesPlugin from '../plugins/package-json-workspaces';
import { BuildscalePluginV2 } from '../project-graph/plugins';
import { LoadedBuildscalePlugin } from '../project-graph/plugins/internal-api';

/**
 * @deprecated Add targets to the projects in a {@link CreateNodes} function instead. This will be removed in Buildscale 19
 */
export type ProjectTargetConfigurator = (
  file: string
) => Record<string, TargetConfiguration>;

/**
 * @deprecated Use {@link BuildscalePluginV2} instead. This will be removed in Buildscale 19
 */
export type BuildscalePluginV1 = {
  name: string;
  /**
   * @deprecated Use {@link CreateNodes} and {@link CreateDependencies} instead. This will be removed in Buildscale 19
   */
  processProjectGraph?: ProjectGraphProcessor;

  /**
   * @deprecated Add targets to the projects inside of {@link CreateNodes} instead. This will be removed in Buildscale 19
   */
  registerProjectTargets?: ProjectTargetConfigurator;

  /**
   * A glob pattern to search for non-standard project files.
   * @example: ["*.csproj", "pom.xml"]
   * @deprecated Use {@link CreateNodes} instead. This will be removed in Buildscale 19
   */
  projectFilePatterns?: string[];
};

/**
 * @todo(@agentender) v19: Remove this fn when we remove readWorkspaceConfig
 */
export function getDefaultPluginsSync(root: string): BuildscalePluginV2[] {
  const plugins: BuildscalePluginV2[] = [
    require('../plugins/js'),
    ...(shouldMergeAngularProjects(root, false)
      ? [require('../adapter/angular-json').NxAngularJsonPlugin]
      : []),
    TargetDefaultsPlugin,
    PackageJsonWorkspacesPlugin,
    ProjectJsonProjectsPlugin,
  ];

  return plugins;
}
