/* eslint-disable @typescript-eslint/no-unused-vars */
import { readBuildscaleJson, updateBuildscaleJson } from '../../generators/utils/buildscale-json';
import { Tree } from '../../generators/tree';
import { BuildscaleJsonConfiguration } from '../../config/buildscale-json';
import { formatChangedFilesWithPrettierIfAvailable } from '../../generators/internal-utils/format-changed-files-with-prettier-if-available';

/**
 * Updates existing workspaces to move buildscale.json's affected.defaultBase to buildscale.json's base.
 */
export default async function update(host: Tree) {
  const buildscaleJson = readBuildscaleJson(host) as BuildscaleJsonConfiguration & {
    affected: { defaultBase?: string };
  };
  if (buildscaleJson?.affected?.defaultBase) {
    buildscaleJson.defaultBase = buildscaleJson.affected.defaultBase;
    delete buildscaleJson.affected.defaultBase;
    if (Object.keys(buildscaleJson.affected).length === 0) {
      delete buildscaleJson.affected;
    }
    updateBuildscaleJson(host, buildscaleJson);
  }
  await formatChangedFilesWithPrettierIfAvailable(host);
}
