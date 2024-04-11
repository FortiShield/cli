import { Tree } from '../../generators/tree';
import { formatChangedFilesWithPrettierIfAvailable } from '../../generators/internal-utils/format-changed-files-with-prettier-if-available';
import {
  getProjects,
  updateProjectConfiguration,
} from '../../generators/utils/project-configuration';
import { readBuildscaleJson, updateBuildscaleJson } from '../../generators/utils/buildscale-json';
import { joinPathFragments } from '../../utils/path';
import { join } from 'path';
import {
  transformLegacyOutputs,
  validateOutputs,
} from '../../tasks-runner/utils';
import { updateJson } from '../../generators/utils/json';
import { PackageJson } from '../../utils/package-json';

export default async function (tree: Tree) {
  // If the workspace doesn't have a buildscale.json, don't make any changes
  if (!tree.exists('buildscale.json')) {
    return;
  }

  const buildscaleJson = readBuildscaleJson(tree);

  for (const [projectName, project] of getProjects(tree)) {
    for (const [_, target] of Object.entries(project.targets ?? {})) {
      if (!target.outputs) {
        continue;
      }

      try {
        validateOutputs(target.outputs);
      } catch (e) {
        target.outputs = transformLegacyOutputs(project.root, e);
      }
    }
    try {
      updateProjectConfiguration(tree, projectName, project);
    } catch {
      if (tree.exists(join(project.root, 'package.json'))) {
        updateJson<PackageJson>(
          tree,
          join(project.root, 'package.json'),
          (json) => {
            for (const target of Object.values(json.buildscale?.targets ?? {})) {
              if (target.outputs) {
                try {
                  validateOutputs(target.outputs);
                } catch (e) {
                  target.outputs = transformLegacyOutputs(project.root, e);
                }
              }
            }

            return json;
          }
        );
      }
    }
  }

  if (buildscaleJson.targetDefaults) {
    for (const [_, target] of Object.entries(buildscaleJson.targetDefaults)) {
      if (!target.outputs) {
        continue;
      }
      try {
        validateOutputs(target.outputs);
      } catch (e: any) {
        target.outputs = transformLegacyOutputs('{projectRoot}', e);
      }
    }

    updateBuildscaleJson(tree, buildscaleJson);
  }

  await formatChangedFilesWithPrettierIfAvailable(tree);
}
