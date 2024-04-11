import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import migrate from './disable-crystal-for-existing-workspaces';

describe('disable crystal for existing workspaces', () => {
  it('should add flag to buildscale.json', () => {
    const tree = createTreeWithEmptyWorkspace();
    migrate(tree);
    expect(tree.read('buildscale.json', 'utf-8')).toMatchInlineSnapshot(`
      "{
        "affected": {
          "defaultBase": "main"
        },
        "targetDefaults": {
          "build": {
            "cache": true
          },
          "lint": {
            "cache": true
          }
        },
        "useInferencePlugins": false
      }
      "
    `);
  });
});
