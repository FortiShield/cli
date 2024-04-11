import { FsTree, Tree } from '../generators/tree';
import { join } from 'path';

export function assertRunsAgainstBuildscaleRepo(
  migrateFn: (tree: Tree) => void | Promise<void>
) {
  it('should run against the Buildscale repo', async () => {
    const tree = new FsTree(join(__dirname, '../../../'), true);
    let resultOrPromise: void | Promise<void> = migrateFn(tree);

    if (resultOrPromise && 'then' in resultOrPromise) {
      await resultOrPromise;
    }
  });
}
