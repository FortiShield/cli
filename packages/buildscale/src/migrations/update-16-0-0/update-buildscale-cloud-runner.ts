import {
  readBuildscaleJson,
  updateBuildscaleJson,
} from '../../generators/utils/project-configuration';
import { Tree } from '../../generators/tree';
import { updateJson } from '../../generators/utils/json';

export default async function (tree: Tree) {
  updateJson(tree, 'package.json', (json) => {
    if (json.dependencies && json.dependencies['@nrwl/buildscale-cloud']) {
      json.dependencies['buildscale-cloud'] = json.dependencies['@nrwl/buildscale-cloud'];
      delete json.dependencies['@nrwl/buildscale-cloud'];
    }

    if (json.devDependencies && json.devDependencies['@nrwl/buildscale-cloud']) {
      json.devDependencies['buildscale-cloud'] = json.devDependencies['@nrwl/buildscale-cloud'];
      delete json.devDependencies['@nrwl/buildscale-cloud'];
    }

    return json;
  });

  const buildscaleJson = readBuildscaleJson(tree);
  if (!buildscaleJson) return;
  for (let opts of Object.values(buildscaleJson.tasksRunnerOptions ?? {})) {
    if (opts.runner === '@nrwl/buildscale-cloud') {
      opts.runner = 'buildscale-cloud';
    }
  }
  updateBuildscaleJson(tree, buildscaleJson);
}
