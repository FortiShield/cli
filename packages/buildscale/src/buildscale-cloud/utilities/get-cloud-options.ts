import { CloudTaskRunnerOptions } from '../buildscale-cloud-tasks-runner-shell';
import { readBuildscaleJson } from '../../config/buildscale-json';
import { getRunnerOptions } from '../../tasks-runner/run-command';

export function getCloudOptions(): CloudTaskRunnerOptions {
  const buildscaleJson = readBuildscaleJson();

  // TODO: The default is not always cloud? But it's not handled at the moment
  return getRunnerOptions('default', buildscaleJson, {}, true);
}
