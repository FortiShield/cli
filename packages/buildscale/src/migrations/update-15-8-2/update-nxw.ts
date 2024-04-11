import { Tree } from '../../generators/tree';
import { updateNxw } from '../../utils/update-buildscalew';

export default async function (tree: Tree) {
  updateNxw(tree);
}
