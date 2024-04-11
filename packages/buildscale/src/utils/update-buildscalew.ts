import {
  getNxWrapperContents,
  buildscaleWrapperPath,
} from '../command-line/init/implementation/dot-buildscale/add-buildscale-scripts';
import type { Tree } from '../generators/tree';
import { normalizePath } from './path';

export function updateNxw(tree: Tree) {
  const wrapperPath = normalizePath(buildscaleWrapperPath());
  if (tree.exists(wrapperPath)) {
    tree.write(wrapperPath, getNxWrapperContents());
  }
}
