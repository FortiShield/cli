import { dirname, join } from 'node:path';

import { ProjectConfiguration } from '../../../config/workspace-json-project-json';
import { toProjectName } from '../../../config/workspaces';
import { readJsonFile } from '../../../utils/fileutils';
import { BuildscalePluginV2 } from '../../../project-graph/plugins';

export const ProjectJsonProjectsPlugin: BuildscalePluginV2 = {
  name: 'buildscale/core/project-json',
  createNodes: [
    '{project.json,**/project.json}',
    (file, _, { workspaceRoot }) => {
      const json = readJsonFile<ProjectConfiguration>(
        join(workspaceRoot, file)
      );
      const project = buildProjectFromProjectJson(json, file);
      return {
        projects: {
          [project.root]: project,
        },
      };
    },
  ],
};

export default ProjectJsonProjectsPlugin;

export function buildProjectFromProjectJson(
  json: Partial<ProjectConfiguration>,
  path: string
): ProjectConfiguration {
  return {
    name: toProjectName(path),
    root: dirname(path),
    ...json,
  };
}
