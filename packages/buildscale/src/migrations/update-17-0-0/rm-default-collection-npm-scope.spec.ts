import { createTree } from '../../generators/testing-utils/create-tree';
import update from './rm-default-collection-npm-scope';
import { readJson, updateJson, writeJson } from '../../generators/utils/json';
import { BuildscaleJsonConfiguration } from '../../config/buildscale-json';
import { Tree } from '../../generators/tree';

describe('rm-default-collection-npm-scope migration', () => {
  let tree: Tree;
  beforeEach(() => {
    tree = createTree();
  });

  describe('with buildscale.json', () => {
    beforeEach(() => {
      writeJson(tree, 'buildscale.json', {
        affected: {
          defaultBase: 'master',
        },
        npmScope: 'scope',
        cli: {
          defaultCollection: 'collection',
        },
      } as BuildscaleJsonConfiguration & { npmScope: string; cli: { defaultCollection: string } });
    });

    it('should remove npmScope', async () => {
      await update(tree);
      expect(readJson(tree, 'buildscale.json').npmScope).not.toBeDefined();
    });

    it('should remove defaultCollection', async () => {
      updateJson<BuildscaleJsonConfiguration>(tree, 'buildscale.json', (json) => {
        json.cli.packageManager = 'npm';
        return json;
      });
      await update(tree);
      expect(readJson(tree, 'buildscale.json').cli).toEqual({
        packageManager: 'npm',
      });
    });

    it('should remove cli', async () => {
      await update(tree);
      expect(readJson(tree, 'buildscale.json').cli).not.toBeDefined();
    });
  });

  describe('without buildscale.json', () => {
    it('should run successfully', async () => {
      await update(tree);
    });
  });
});
