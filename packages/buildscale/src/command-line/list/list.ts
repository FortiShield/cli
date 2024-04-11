import { workspaceRoot } from '../../utils/workspace-root';
import { output } from '../../utils/output';
import {
  fetchCorePlugins,
  getInstalledPluginsAndCapabilities,
  listCorePlugins,
  listInstalledPlugins,
  listPluginCapabilities,
} from '../../utils/plugins';
import {
  getLocalWorkspacePlugins,
  listLocalWorkspacePlugins,
} from '../../utils/plugins/local-plugins';
import {
  createProjectGraphAsync,
  readProjectsConfigurationFromProjectGraph,
} from '../../project-graph/project-graph';
import { readBuildscaleJson } from '../../config/buildscale-json';

export interface ListArgs {
  /** The name of an installed plugin to query  */
  plugin?: string | undefined;
}

/**
 * List available plugins or capabilities within a specific plugin
 *
 * @remarks
 *
 * Must be run within an Buildscale workspace
 *
 */
export async function listHandler(args: ListArgs): Promise<void> {
  const buildscaleJson = readBuildscaleJson();
  const projectGraph = await createProjectGraphAsync({ exitOnError: true });
  const projects = readProjectsConfigurationFromProjectGraph(projectGraph);

  if (args.plugin) {
    await listPluginCapabilities(args.plugin, projects.projects);
  } else {
    const corePlugins = fetchCorePlugins();

    const localPlugins = await getLocalWorkspacePlugins(projects, buildscaleJson);
    const installedPlugins = await getInstalledPluginsAndCapabilities(
      workspaceRoot,
      projects.projects
    );

    if (localPlugins.size) {
      listLocalWorkspacePlugins(localPlugins);
    }
    listInstalledPlugins(installedPlugins);
    listCorePlugins(installedPlugins, corePlugins);

    output.note({
      title: 'Community Plugins',
      bodyLines: [
        'Looking for a technology / framework not listed above?',
        'There are many excellent plugins maintained by the Buildscale community.',
        'Search for the one you need here: https://buildscale.github.io/plugins/registry.',
      ],
    });

    output.note({
      title: `Use "buildscale list [plugin]" to find out more`,
    });
  }
}
