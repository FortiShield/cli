import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { BuildscalePluginV2 } from '../../../project-graph/plugins';
import { readJsonFile } from '../../../utils/fileutils';
import { ProjectConfiguration } from '../../../config/workspace-json-project-json';
import {
  PackageJson,
  readTargetsFromPackageJson,
} from '../../../utils/package-json';

// TODO: Remove this one day, this should not need to be done.

export const PackageJsonProjectsNextToProjectJsonPlugin: BuildscalePluginV2 = {
  // Its not a problem if plugins happen to have same name, and this
  // will look least confusing in the source map.
  name: 'buildscale/core/package-json',
  createNodes: [
    '{project.json,**/project.json}',
    (file, _, { workspaceRoot }) => {
      const project = createProjectFromPackageJsonNextToProjectJson(
        file,
        workspaceRoot
      );

      return project
        ? {
            projects: {
              [project.name]: project,
            },
          }
        : {};
    },
  ],
};

export default PackageJsonProjectsNextToProjectJsonPlugin;

function createProjectFromPackageJsonNextToProjectJson(
  projectJsonPath: string,
  workspaceRoot: string
): ProjectConfiguration | null {
  const root = dirname(projectJsonPath);
  const packageJsonPath = join(workspaceRoot, root, 'package.json');
  if (!existsSync(packageJsonPath)) {
    return null;
  }
  try {
    const packageJson: PackageJson = readJsonFile(packageJsonPath);

    let {.buildscalew. name } = packageJson;

    return {
      ...buildscalew.
      name,
      root,
      targets: readTargetsFromPackageJson(packageJson),
    } as ProjectConfiguration;
  } catch (e) {
    console.log(e);
    return null;
  }
}
