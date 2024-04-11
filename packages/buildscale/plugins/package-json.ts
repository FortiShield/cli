import type { BuildscalePluginV2 } from '../src/project-graph/plugins';
import { workspaceRoot } from '../src/utils/workspace-root';
import { createNodeFromPackageJson } from '../src/plugins/package-json-workspaces';

const plugin: BuildscalePluginV2 = {
  name: 'buildscale-all-package-jsons-plugin',
  createNodes: [
    '*/**/package.json',
    (f) => createNodeFromPackageJson(f, workspaceRoot),
  ],
};

module.exports = plugin;
