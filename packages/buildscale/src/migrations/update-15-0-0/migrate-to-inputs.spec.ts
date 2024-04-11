import { assertRunsAgainstBuildscaleRepo } from '../../internal-testing-utils/run-migration-against-this-workspace';
import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import type { Tree } from '../../generators/tree';
import {
  addProjectConfiguration,
  readBuildscaleJson,
  readProjectConfiguration,
  updateBuildscaleJson,
} from '../../generators/utils/project-configuration';
import { readJson, updateJson, writeJson } from '../../generators/utils/json';
import migrateToInputs from './migrate-to-inputs';
import { BuildscaleJsonConfiguration } from '../../config/buildscale-json';

describe('15.0.0 migration (migrate-to-inputs)', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should add build inputs configuration to inputs', async () => {
    updateBuildscaleJson(tree, {
      targetDefaults: {
        build: {
          dependsOn: ['^build'],
        },
      },
      implicitDependencies: {
        '.eslintrc.json': '*',
      },
    });
    addProjectConfiguration(tree, 'proj', {
      root: 'proj',
      targets: {
        build: {
          executor: 'buildscale:run-commands',
          options: {},
        },
      },
    });
    await migrateToInputs(tree);

    const updated = readBuildscaleJson(tree);

    expect(updated.implicitDependencies).toBeUndefined();
    expect(updated).toMatchInlineSnapshot(`
      {
        "namedInputs": {
          "default": [
            "{projectRoot}/**/*",
            "sharedGlobals",
          ],
          "production": [
            "default",
          ],
          "sharedGlobals": [],
        },
        "targetDefaults": {
          "build": {
            "dependsOn": [
              "^build",
            ],
            "inputs": [
              "production",
              "^production",
            ],
          },
        },
      }
    `);
  });

  it('should not add build inputs configuration to inputs', async () => {
    updateBuildscaleJson(tree, {
      targetDefaults: {
        prepare: {
          dependsOn: ['^prepare'],
        },
      },
      implicitDependencies: {
        '.eslintrc.json': '*',
      },
    });
    addProjectConfiguration(tree, 'proj', {
      root: 'proj',
      targets: {
        nobuild: {
          executor: 'buildscale:run-commands',
          options: {},
        },
      },
    });
    await migrateToInputs(tree);

    const updated = readBuildscaleJson(tree);

    expect(updated.implicitDependencies).toBeUndefined();
    expect(updated).toMatchInlineSnapshot(`
      {
        "namedInputs": {
          "default": [
            "{projectRoot}/**/*",
            "sharedGlobals",
          ],
          "production": [
            "default",
          ],
          "sharedGlobals": [],
        },
        "targetDefaults": {
          "prepare": {
            "dependsOn": [
              "^prepare",
            ],
          },
        },
      }
    `);
  });

  it('should add implicitDependencies that affect all projects to sharedGlobals', async () => {
    updateBuildscaleJson(tree, {
      implicitDependencies: {
        Jenkinsfile: '*',
      },
    });
    await migrateToInputs(tree);

    const updated = readBuildscaleJson(tree);

    expect(updated.implicitDependencies).toBeUndefined();
    expect(updated.namedInputs.sharedGlobals).toContain(
      '{workspaceRoot}/Jenkinsfile'
    );
  });

  it('should not add package.json to filesets', async () => {
    updateBuildscaleJson(tree, {
      implicitDependencies: {
        'package.json': {
          dependencies: '*',
          devDependencies: '*',
        },
      },
    });
    await migrateToInputs(tree);

    const updated = readBuildscaleJson(tree);

    expect(updated.implicitDependencies).toBeUndefined();
    expect(updated.namedInputs.sharedGlobals).toEqual([]);
  });

  it('should handle other .json files', async () => {
    updateBuildscaleJson(tree, {
      implicitDependencies: {
        'config.json': {
          important: '*',
        },
      },
    });
    await migrateToInputs(tree);

    const updated = readBuildscaleJson(tree);

    expect(updated.implicitDependencies).toBeUndefined();
    expect(updated.namedInputs.sharedGlobals).toContain(
      '{workspaceRoot}/config.json'
    );
  });

  it('should add project specific implicit dependencies to project namedInputs', async () => {
    updateBuildscaleJson(tree, {
      implicitDependencies: {
        'tools/scripts/build-app.js': ['app1', 'app2'],
      },
    });
    addProjectConfiguration(tree, 'app1', {
      root: 'app1',
    });
    addProjectConfiguration(tree, 'app2', {
      root: 'app2',
    });
    addProjectConfiguration(tree, 'lib1', {
      root: 'lib1',
    });

    await migrateToInputs(tree);

    const updated = readBuildscaleJson(tree);
    expect(updated.implicitDependencies).toBeUndefined();
    expect(updated.namedInputs.projectSpecificFiles).toEqual([]);
    expect(updated.namedInputs.default).toContain('projectSpecificFiles');

    const app1 = readProjectConfiguration(tree, 'app1');
    expect(app1.namedInputs.projectSpecificFiles).toContain(
      '{workspaceRoot}/tools/scripts/build-app.js'
    );
    const app2 = readProjectConfiguration(tree, 'app2');
    expect(app2.namedInputs.projectSpecificFiles).toContain(
      '{workspaceRoot}/tools/scripts/build-app.js'
    );

    const lib = readProjectConfiguration(tree, 'lib1');
    expect(lib.namedInputs).toBeUndefined();
  });

  it('should add project specific implicit dependencies to projects with package.json', async () => {
    updateJson(tree, 'package.json', (j) => ({
      ...j,
      workspaces: ['**/package.json'],
    }));
    updateBuildscaleJson(tree, {
      implicitDependencies: {
        'tools/scripts/build-app.js': ['app1', 'app2'],
      },
    });
    addProjectConfiguration(tree, 'app1', {
      root: 'app1',
    });
    addProjectConfiguration(tree, 'app2', {
      root: 'app2',
    });
    tree.delete('app2/project.json');
    writeJson(tree, 'app2/package.json', { name: 'app2', buildscale: {} });
    addProjectConfiguration(tree, 'lib1', {
      root: 'lib1',
    });

    await migrateToInputs(tree);

    const updated = readBuildscaleJson(tree);
    expect(updated.implicitDependencies).toBeUndefined();
    expect(updated.namedInputs.projectSpecificFiles).toEqual([]);
    expect(updated.namedInputs.default).toContain('projectSpecificFiles');

    const app1 = readProjectConfiguration(tree, 'app1');
    expect(app1.namedInputs.projectSpecificFiles).toContain(
      '{workspaceRoot}/tools/scripts/build-app.js'
    );
    const app2 = readJson(tree, 'app2/package.json');
    expect(app2.buildscalew.namedInputs.projectSpecificFiles).toContain(
      '{workspaceRoot}/tools/scripts/build-app.js'
    );

    const lib = readProjectConfiguration(tree, 'lib1');
    expect(lib.namedInputs).toBeUndefined();
  });

  it('should do nothing if there are no implicitDependencies', async () => {
    const buildscaleJson: BuildscaleJsonConfiguration = {
      namedInputs: {
        default: ['{projectRoot}/**/*'],
        production: ['default'],
        sharedGlobals: ['babel.config.json'],
      },
      targetDefaults: {
        build: {
          dependsOn: ['^build'],
          inputs: ['default', '^default'],
        },
      },
    };
    updateBuildscaleJson(tree, buildscaleJson);

    await migrateToInputs(tree);

    const updated = readBuildscaleJson(tree);
    expect(updated.implicitDependencies).toBeUndefined();
    expect(updated).toEqual(buildscaleJson);
  });

  it('should not make any changes if there is no buildscale.json', async () => {
    tree.delete('buildscale.json');

    await migrateToInputs(tree);

    expect(tree.exists('buildscale.json')).toEqual(false);
  });

  it('should not make any changes if the workspace extends npm.json', async () => {
    const workspace = readBuildscaleJson(tree);
    workspace.extends = 'buildscale/presets/npm.json';
    updateBuildscaleJson(tree, workspace);

    await migrateToInputs(tree);

    const updatedWorkspace = readBuildscaleJson(tree);
    expect(updatedWorkspace.namedInputs).not.toBeDefined();
  });

  it('should not override production inputs when migrating "implicitDependencies"', async () => {
    updateBuildscaleJson(tree, {
      namedInputs: {
        default: ['{projectRoot}/**/*', 'sharedGlobals'],
        production: [
          'default',
          '!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)',
          '!{projectRoot}/tsconfig.spec.json',
          '!{projectRoot}/jest.config.[jt]s',
          '!{projectRoot}/.eslintrc.json',
        ],
        sharedGlobals: ['{workspaceRoot}/buildscale.json'],
      },
      implicitDependencies: {
        '.eslintrc.json': '*',
      },
    });
    await migrateToInputs(tree);

    const updated = readBuildscaleJson(tree);

    expect(updated.implicitDependencies).toBeUndefined();
    expect(updated).toMatchInlineSnapshot(`
      {
        "namedInputs": {
          "default": [
            "{projectRoot}/**/*",
            "sharedGlobals",
          ],
          "production": [
            "default",
            "!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)",
            "!{projectRoot}/tsconfig.spec.json",
            "!{projectRoot}/jest.config.[jt]s",
            "!{projectRoot}/.eslintrc.json",
          ],
          "sharedGlobals": [
            "{workspaceRoot}/buildscale.json",
          ],
        },
      }
    `);
  });

  it('should only preppend "default" to production inputs if missing when migrating "implicitDependencies"', async () => {
    updateBuildscaleJson(tree, {
      namedInputs: {
        default: ['{projectRoot}/**/*', 'sharedGlobals'],
        production: [
          '!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)',
          '!{projectRoot}/tsconfig.spec.json',
          '!{projectRoot}/jest.config.[jt]s',
          '!{projectRoot}/.eslintrc.json',
        ],
        sharedGlobals: ['{workspaceRoot}/buildscale.json'],
      },
      implicitDependencies: {
        '.eslintrc.json': '*',
      },
    });
    await migrateToInputs(tree);

    const updated = readBuildscaleJson(tree);

    expect(updated.implicitDependencies).toBeUndefined();
    expect(updated).toMatchInlineSnapshot(`
      {
        "namedInputs": {
          "default": [
            "{projectRoot}/**/*",
            "sharedGlobals",
          ],
          "production": [
            "default",
            "!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)",
            "!{projectRoot}/tsconfig.spec.json",
            "!{projectRoot}/jest.config.[jt]s",
            "!{projectRoot}/.eslintrc.json",
          ],
          "sharedGlobals": [
            "{workspaceRoot}/buildscale.json",
          ],
        },
      }
    `);
  });

  it('should not modify production inputs if "default" is missing when migrating "implicitDependencies"', async () => {
    updateBuildscaleJson(tree, {
      namedInputs: {
        production: [
          '!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)',
          '!{projectRoot}/tsconfig.spec.json',
          '!{projectRoot}/jest.config.[jt]s',
          '!{projectRoot}/.eslintrc.json',
        ],
        sharedGlobals: ['{workspaceRoot}/buildscale.json'],
      },
      implicitDependencies: {
        '.eslintrc.json': '*',
      },
    });
    await migrateToInputs(tree);

    const updated = readBuildscaleJson(tree);

    expect(updated.implicitDependencies).toBeUndefined();
    expect(updated).toMatchInlineSnapshot(`
      {
        "namedInputs": {
          "production": [
            "!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)",
            "!{projectRoot}/tsconfig.spec.json",
            "!{projectRoot}/jest.config.[jt]s",
            "!{projectRoot}/.eslintrc.json",
          ],
          "sharedGlobals": [
            "{workspaceRoot}/buildscale.json",
          ],
        },
      }
    `);
  });
});

describe('15.0.0 migration (migrate-to-inputs) (v1)', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should add project specific implicit dependencies to project namedInputs', async () => {
    updateBuildscaleJson(tree, {
      implicitDependencies: {
        'tools/scripts/build-app.js': ['app1', 'app2'],
      },
    });
    addProjectConfiguration(tree, 'app1', {
      root: 'app1',
    });
    addProjectConfiguration(tree, 'app2', {
      root: 'app2',
    });
    addProjectConfiguration(tree, 'lib1', {
      root: 'lib1',
    });

    await migrateToInputs(tree);

    const updated = readBuildscaleJson(tree);
    expect(updated.implicitDependencies).toBeUndefined();
    expect(updated.namedInputs.projectSpecificFiles).toEqual([]);
    expect(updated.namedInputs.default).toContain('projectSpecificFiles');

    const app1 = readProjectConfiguration(tree, 'app1');
    expect(app1.namedInputs.projectSpecificFiles).toContain(
      '{workspaceRoot}/tools/scripts/build-app.js'
    );
    const app2 = readProjectConfiguration(tree, 'app2');
    expect(app2.namedInputs.projectSpecificFiles).toContain(
      '{workspaceRoot}/tools/scripts/build-app.js'
    );

    const lib = readProjectConfiguration(tree, 'lib1');
    expect(lib.namedInputs).toBeUndefined();
  });

  assertRunsAgainstBuildscaleRepo(migrateToInputs);
});
