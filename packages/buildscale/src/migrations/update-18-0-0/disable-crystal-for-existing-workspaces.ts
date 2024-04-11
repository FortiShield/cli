import { readBuildscaleJson, updateBuildscaleJson } from '../../generators/utils/buildscale-json';
import { Tree } from '../../generators/tree';

export default function migrate(tree: Tree) {
  const buildscaleJson = readBuildscaleJson(tree);
  buildscaleJson.useInferencePlugins = false;
  updateBuildscaleJson(tree, buildscaleJson);
}
