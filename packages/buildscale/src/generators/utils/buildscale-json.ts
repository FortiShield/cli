import { relative } from 'path';
import type { BuildscaleJsonConfiguration } from '../../config/buildscale-json';

import type { Tree } from '../tree';

import { readJson, updateJson } from './json';
import { readBuildscaleJson as readBuildscaleJsonFromDisk } from '../../config/buildscale-json';

/**
 * @deprecated You must pass a {@link Tree}
 */
export function readBuildscaleJson(): BuildscaleJsonConfiguration | null;
export function readBuildscaleJson(tree: Tree): BuildscaleJsonConfiguration | null;

/**
 * Reads buildscale.json
 */
export function readBuildscaleJson(tree?: Tree): BuildscaleJsonConfiguration | null {
  if (tree) {
    if (!tree.exists('buildscale.json')) {
      return null;
    }
    let buildscaleJson = readJson<BuildscaleJsonConfiguration>(tree, 'buildscale.json');
    if (buildscaleJson.extends) {
      buildscaleJson = { ...readBuildscaleJsonExtends(tree, buildscaleJson.extends), ...buildscaleJson };
    }
    return buildscaleJson;
  } else {
    return readBuildscaleJsonFromDisk();
  }
}

/**
 * Update buildscale.json
 */
export function updateBuildscaleJson(tree: Tree, buildscaleJson: BuildscaleJsonConfiguration): void {
  if (tree.exists('buildscale.json')) {
    updateJson<BuildscaleJsonConfiguration>(tree, 'buildscale.json', (json) => {
      if (json.extends) {
        const buildscaleJsonExtends = readBuildscaleJsonExtends(tree, json.extends);
        const changedPropsOfBuildscaleJson = {};
        Object.keys(buildscaleJson).forEach((prop) => {
          if (
            JSON.stringify(buildscaleJson[prop], null, 2) !=
            JSON.stringify(buildscaleJsonExtends[prop], null, 2)
          ) {
            changedPropsOfBuildscaleJson[prop] = buildscaleJson[prop];
          }
        });
        return changedPropsOfBuildscaleJson;
      } else {
        return buildscaleJson;
      }
    });
  }
}

function readBuildscaleJsonExtends(tree: Tree, extendsPath: string) {
  try {
    return readJson(
      tree,
      relative(
        tree.root,
        require.resolve(extendsPath, {
          paths: [tree.root],
        })
      )
    );
  } catch (e) {
    throw new Error(`Unable to resolve buildscale.json extends. Error: ${e.message}`);
  }
}
