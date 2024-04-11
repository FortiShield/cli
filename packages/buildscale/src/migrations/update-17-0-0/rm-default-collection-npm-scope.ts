import { formatChangedFilesWithPrettierIfAvailable } from '../../generators/internal-utils/format-changed-files-with-prettier-if-available';
import { Tree } from '../../generators/tree';
import { readBuildscaleJson, updateBuildscaleJson } from '../../generators/utils/buildscale-json';
import { readJson } from '../../generators/utils/json';
import { output } from '../../utils/output';
import { BuildscaleJsonConfiguration } from '../../config/buildscale-json';
import { joinPathFragments } from '../../utils/path';

export default async function update(tree: Tree) {
  if (!tree.exists('buildscale.json')) {
    return;
  }

  const buildscaleJson = readBuildscaleJson(tree);

  delete buildscaleJson.cli?.['defaultCollection'];

  if (buildscaleJson?.cli && Object.keys(buildscaleJson.cli).length < 1) {
    delete buildscaleJson.cli;
  }

  warnNpmScopeHasChanged(tree, buildscaleJson);

  delete buildscaleJson['npmScope'];

  updateBuildscaleJson(tree, buildscaleJson);

  await formatChangedFilesWithPrettierIfAvailable(tree);
}

function warnNpmScopeHasChanged(
  tree: Tree,
  buildscaleJson: BuildscaleJsonConfiguration
): boolean {
  const originalScope = buildscaleJson['npmScope'];

  // There was no original scope
  if (!originalScope) {
    return false;
  }

  // package.json does not exist
  if (!tree.exists('package.json')) {
    return false;
  }

  const newScope = getNpmScopeFromPackageJson(tree);

  // New and Original scope are the same.
  if (originalScope === newScope) {
    return false;
  }

  const packageJsonName = readJson(tree, 'package.json').name;

  if (newScope) {
    output.warn({
      title: 'npmScope has been removed from buildscale.json',
      bodyLines: [
        'This will now be read from package.json',
        `Old value which was in buildscale.json: ${originalScope}`,
        `New value from package.json: ${newScope}`,
        `Typescript path mappings for new libraries will now be generated as such: @${newScope}/new-lib instead of @${originalScope}/new-lib`,
        `If you would like to change this back, change the name in package.json to ${packageJsonName.replace(
          newScope,
          originalScope
        )}`,
      ],
    });
  } else {
    // There is no scope in package.json
    output.warn({
      title: 'npmScope has been removed from buildscale.json',
      bodyLines: [
        'This will now be read from package.json',
        `Old value which was in buildscale.json: ${originalScope}`,
        `New value from package.json: null`,
        `Typescript path mappings for new libraries will now be generated as such: new-lib instead of @${originalScope}/new-lib`,
        `If you would like to change this back, change the name in package.json to ${joinPathFragments(
          `@${originalScope}`,
          packageJsonName
        )}`,
      ],
    });
  }
}

function getNpmScopeFromPackageJson(tree: Tree) {
  const { name } = tree.exists('package.json')
    ? readJson<{ name?: string }>(tree, 'package.json')
    : { name: null };

  if (name?.startsWith('@')) {
    return name.split('/')[0].substring(1);
  }
}
