import { Tree } from '../../generators/tree';
import ignore from 'ignore';

export default function moveCacheDirectory(tree: Tree) {
  // If buildscale.json doesn't exist the repo can't utilize
  // caching, so .buildscale/cache is less relevant. Lerna users
  // that don't want to fully opt in to Buildscale at this time
  // may also be caught off guard by the appearance of
  // a .buildscale directory, so we are going to special case
  // this for the time being.
  if (tree.exists('lerna.json') && !tree.exists('buildscale.json')) {
    return;
  }

  updateGitIgnore(tree);

  if (tree.exists('.prettierignore')) {
    const ignored = tree.read('.prettierignore', 'utf-8');
    if (!ignored.includes('.buildscale/cache')) {
      tree.write('.prettierignore', [ignored, '/.buildscale/cache'].join('\n'));
    }
  }
}

function updateGitIgnore(tree: Tree) {
  const gitignore = tree.exists('.gitignore')
    ? tree.read('.gitignore', 'utf-8')
    : '';
  const ig = ignore();
  ig.add(gitignore);
  if (!ig.ignores('.buildscale/cache')) {
    const updatedLines = gitignore.length
      ? [gitignore, '.buildscale/cache']
      : ['.buildscale/cache'];
    tree.write('.gitignore', updatedLines.join('\n'));
  }
}
