import {
  addProjectConfiguration,
  readBuildscaleJson,
  readProjectConfiguration,
} from '../../generators/utils/project-configuration';

import update from './update-depends-on-to-tokens';
import { updateJson, writeJson } from '../../generators/utils/json';
import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import { assertRunsAgainstBuildscaleRepo } from '../../internal-testing-utils/run-migration-against-this-workspace';

describe('update-depends-on-to-tokens', () => {
  it('should update buildscale.json', async () => {
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'buildscale.json', (json) => {
      json.targetDefaults = {
        build: {
          dependsOn: [
            {
              projects: 'self',
            },
          ],
          inputs: [{ projects: 'self', input: 'someInput' }],
        },
        test: {
          dependsOn: [
            {
              projects: 'dependencies',
            },
          ],
          inputs: [{ projects: 'dependencies', input: 'someInput' }],
        },
        other: {
          dependsOn: ['^deps'],
        },
      };
      return json;
    });
    await update(tree);
    const buildscaleJson = readBuildscaleJson(tree);
    const buildDependencyConfiguration = buildscaleJson.targetDefaults.build
      .dependsOn[0] as any;
    const testDependencyConfiguration = buildscaleJson.targetDefaults.test
      .dependsOn[0] as any;
    const buildInputConfiguration = buildscaleJson.targetDefaults.build
      .inputs[0] as any;
    const testInputConfiguration = buildscaleJson.targetDefaults.test.inputs[0] as any;
    expect(buildDependencyConfiguration.projects).not.toBeDefined();
    expect(buildDependencyConfiguration.dependencies).not.toBeDefined();
    expect(buildInputConfiguration.projects).not.toBeDefined();
    expect(buildInputConfiguration.dependencies).not.toBeDefined();
    expect(testInputConfiguration.projects).not.toBeDefined();
    expect(testInputConfiguration.dependencies).toEqual(true);
    expect(testDependencyConfiguration.projects).not.toBeDefined();
    expect(testDependencyConfiguration.dependencies).toEqual(true);
    expect(buildscaleJson.targetDefaults.other.dependsOn).toEqual(['^deps']);
  });

  it('should update project configurations', async () => {
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'proj1', {
      root: 'proj1',
      targets: {
        build: {
          dependsOn: [
            {
              projects: 'self',
              target: 'build',
            },
          ],
          inputs: [{ projects: 'self', input: 'someInput' }],
        },
        test: {
          dependsOn: [
            {
              projects: 'dependencies',
              target: 'test',
            },
          ],
          inputs: [{ projects: 'dependencies', input: 'someInput' }],
        },
        other: {
          dependsOn: ['^deps'],
        },
      },
    });
    await update(tree);
    const project = readProjectConfiguration(tree, 'proj1');
    const buildDependencyConfiguration = project.targets.build
      .dependsOn[0] as any;
    const testDependencyConfiguration = project.targets.test
      .dependsOn[0] as any;
    const buildInputConfiguration = project.targets.build.inputs[0] as any;
    const testInputConfiguration = project.targets.test.inputs[0] as any;
    expect(buildDependencyConfiguration.projects).not.toBeDefined();
    expect(buildDependencyConfiguration.dependencies).not.toBeDefined();
    expect(buildInputConfiguration.projects).not.toBeDefined();
    expect(buildInputConfiguration.dependencies).not.toBeDefined();
    expect(testDependencyConfiguration.projects).not.toBeDefined();
    expect(testDependencyConfiguration.dependencies).toEqual(true);
    expect(testInputConfiguration.projects).not.toBeDefined();
    expect(testInputConfiguration.dependencies).toEqual(true);
    expect(project.targets.other.dependsOn).toEqual(['^deps']);
    expect(project.targets.other.inputs).not.toBeDefined();
  });

  it('should not throw on nulls', async () => {
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'proj1', {
      root: 'proj1',
    });
    addProjectConfiguration(tree, 'proj2', {
      root: 'proj2',
      targets: {
        build: {},
      },
    });
    writeJson(tree, 'buildscale.json', {});
    let promise = update(tree);
    await expect(promise).resolves.toBeUndefined();
    writeJson(tree, 'buildscale.json', {
      targetDefaults: {
        build: {},
      },
    });
    promise = update(tree);
    await expect(promise).resolves.toBeUndefined();
  });

  assertRunsAgainstBuildscaleRepo(update);
});
