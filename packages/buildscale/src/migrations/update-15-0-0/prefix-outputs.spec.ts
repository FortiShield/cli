import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import type { Tree } from '../../generators/tree';
import {
  addProjectConfiguration,
  readBuildscaleJson,
  readProjectConfiguration,
  updateBuildscaleJson,
} from '../../generators/utils/project-configuration';
import { readJson, writeJson } from '../../generators/utils/json';
import prefixOutputs from './prefix-outputs';
import { validateOutputs } from '../../tasks-runner/utils';

describe('15.0.0 migration (prefix-outputs)', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should prefix project outputs', async () => {
    addProjectConfiguration(tree, 'proj', {
      root: 'proj',
      targets: {
        build: {
          executor: 'buildscale:run-commands',
          outputs: [
            'dist',
            'dist/{projectRoot}',
            'dist/{projectRoot}/**/*.js',
            'proj/coverage',
            './test-results',
            '{projectRoot}/build',
            '{options.outputDirectory}',
          ],
          options: {},
        },
      },
    });

    await prefixOutputs(tree);

    const updated = readProjectConfiguration(tree, 'proj');

    expect(updated.targets.build.outputs).toEqual([
      '{workspaceRoot}/dist',
      '{workspaceRoot}/dist/{projectRoot}',
      '{workspaceRoot}/dist/{projectRoot}/**/*.js',
      '{projectRoot}/coverage',
      '{projectRoot}/test-results',
      '{projectRoot}/build',
      '{options.outputDirectory}',
    ]);

    expect(() => validateOutputs(updated.targets.build.outputs)).not.toThrow();
  });

  it('should prefix target default outputs', async () => {
    const buildscaleJson = readBuildscaleJson(tree);
    updateBuildscaleJson(tree, {
      ...buildscaleJson,
      targetDefaults: {
        build: {
          outputs: ['dist', '{projectRoot}/build', '{options.outputPath}'],
        },
      },
    });

    await prefixOutputs(tree);

    const updated = readBuildscaleJson(tree);

    expect(updated.targetDefaults).toMatchInlineSnapshot(`
      {
        "build": {
          "outputs": [
            "{workspaceRoot}/dist",
            "{projectRoot}/build",
            "{options.outputPath}",
          ],
        },
      }
    `);
  });

  it('should migrate package.json projects', async () => {
    writeJson(tree, 'proj/package.json', {
      name: 'proj',
      scripts: {
        build: 'echo',
      },
      buildscale: {
        targets: {
          build: {
            outputs: ['dist/proj', 'proj/build'],
          },
        },
      },
    });
    tree.delete('workspace.json');

    await prefixOutputs(tree);

    expect(readJson(tree, 'proj/package.json').buildscalew.targets.build).toEqual({
      outputs: ['{workspaceRoot}/dist/proj', '{projectRoot}/build'],
    });
  });

  it('should not error for package.json projects', async () => {
    writeJson(tree, 'proj/package.json', {
      name: 'proj',
      scripts: {
        build: 'echo',
      },
    });
    tree.delete('workspace.json');

    await prefixOutputs(tree);
  });

  it('should handle negated outputs', async () => {
    const buildscaleJson = readBuildscaleJson(tree);
    updateBuildscaleJson(tree, {
      ...buildscaleJson,
      targetDefaults: {
        build: {
          outputs: ['!dist', '{projectRoot}/build', '{options.outputPath}'],
        },
      },
    });

    await prefixOutputs(tree);

    const updated = readBuildscaleJson(tree);

    expect(updated.targetDefaults).toMatchInlineSnapshot(`
      {
        "build": {
          "outputs": [
            "!{workspaceRoot}/dist",
            "{projectRoot}/build",
            "{options.outputPath}",
          ],
        },
      }
    `);
  });
});

describe('15.0.0 migration (prefix-outputs) (v1)', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should prefix project outputs', async () => {
    addProjectConfiguration(tree, 'proj', {
      root: 'proj',
      targets: {
        build: {
          executor: 'buildscale:run-commands',
          outputs: [
            'dist',
            'dist/{projectRoot}',
            'dist/{projectRoot}/**/*.js',
            'proj/coverage',
            './test-results',
            '{projectRoot}/build',
            '{options.outputDirectory}',
          ],
          options: {},
        },
      },
    });

    await prefixOutputs(tree);

    const updated = readProjectConfiguration(tree, 'proj');

    expect(updated.targets.build.outputs).toEqual([
      '{workspaceRoot}/dist',
      '{workspaceRoot}/dist/{projectRoot}',
      '{workspaceRoot}/dist/{projectRoot}/**/*.js',
      '{projectRoot}/coverage',
      '{projectRoot}/test-results',
      '{projectRoot}/build',
      '{options.outputDirectory}',
    ]);

    expect(() => validateOutputs(updated.targets.build.outputs)).not.toThrow();
  });
});
