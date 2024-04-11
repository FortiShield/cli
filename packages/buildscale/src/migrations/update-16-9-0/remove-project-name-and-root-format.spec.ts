import { readJson, writeJson } from '../../generators/utils/json';
import { createTree } from '../../generators/testing-utils/create-tree';
import removeProjectNameAndRootFormat from './remove-project-name-and-root-format';
import { BuildscaleJsonConfiguration } from '../../config/buildscale-json';

describe('removeProjectNameAndRootFormat', () => {
  let tree;
  beforeEach(() => {
    tree = createTree();
  });

  it('should not error if buildscale.json is not present', async () => {
    await removeProjectNameAndRootFormat(tree);
  });

  it('should not update buildscale.json if projectNameAndRoot is not present', async () => {
    const buildscaleJson: BuildscaleJsonConfiguration = {};
    writeJson(tree, 'buildscale.json', buildscaleJson);
    await removeProjectNameAndRootFormat(tree);
    expect(readJson(tree, 'buildscale.json')).toEqual(buildscaleJson);
  });

  it('should remove projectNameAndRoot if it is present', async () => {
    const buildscaleJson: any = {
      workspaceLayout: {
        libsDir: 'libs',
        projectNameAndRootFormat: 'as-provided',
      },
    };
    writeJson(tree, 'buildscale.json', buildscaleJson);
    await removeProjectNameAndRootFormat(tree);
    expect(readJson(tree, 'buildscale.json').workspaceLayout).toEqual({
      libsDir: 'libs',
    });
  });

  it('should remove workspaceLayout if it is present', async () => {
    const buildscaleJson: any = {
      workspaceLayout: {
        projectNameAndRootFormat: 'as-provided',
      },
    };
    writeJson(tree, 'buildscale.json', buildscaleJson);
    await removeProjectNameAndRootFormat(tree);
    expect(readJson(tree, 'buildscale.json').workspaceLayout).not.toBeDefined();
  });
});
