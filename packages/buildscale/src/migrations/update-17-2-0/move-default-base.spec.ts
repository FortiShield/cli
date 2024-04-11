import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import { Tree } from '../../generators/tree';
import { readBuildscaleJson, updateBuildscaleJson } from '../../generators/utils/buildscale-json';

import update from './move-default-base';

describe('update-17.1.0 migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it("shouldn't do anything if affected.defaultBase is not set", async () => {
    tree.write('buildscale.json', JSON.stringify({}));
    await update(tree);
    expect(readBuildscaleJson(tree)).toEqual({});
  });

  it("shouldn't remove affected if other keys present", async () => {
    updateBuildscaleJson(tree, {
      affected: {
        defaultBase: 'master',
        otherKey: 'otherValue',
      } as any,
    });
    await update(tree);
    expect(readBuildscaleJson(tree)).toEqual({
      affected: {
        otherKey: 'otherValue',
      },
      defaultBase: 'master',
    });
  });

  it('should remove affected if no other keys present', async () => {
    updateBuildscaleJson(tree, {
      affected: {
        defaultBase: 'master',
      } as any,
    });
    await update(tree);
    expect(readBuildscaleJson(tree)).toEqual({
      defaultBase: 'master',
    });
  });
});
