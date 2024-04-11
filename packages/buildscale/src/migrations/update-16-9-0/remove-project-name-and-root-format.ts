import { Tree } from '../../generators/tree';
import { updateJson } from '../../generators/utils/json';
import { formatChangedFilesWithPrettierIfAvailable } from '../../generators/internal-utils/format-changed-files-with-prettier-if-available';

export default async function removeProjectNameAndRootFormat(tree: Tree) {
  if (!tree.exists('buildscale.json')) {
    return;
  }

  updateJson(tree, 'buildscale.json', (buildscaleJson) => {
    if (!buildscaleJson.workspaceLayout) {
      return buildscaleJson;
    }

    delete buildscaleJson.workspaceLayout.projectNameAndRootFormat;

    if (Object.keys(buildscaleJson.workspaceLayout).length === 0) {
      delete buildscaleJson.workspaceLayout;
    }

    return buildscaleJson;
  });

  await formatChangedFilesWithPrettierIfAvailable(tree);
}
