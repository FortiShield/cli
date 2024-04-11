import { readBuildscaleJson } from '../../config/buildscale-json';
import { isBuildscaleCloudUsed } from '../../utils/buildscale-cloud-utils';
import { output } from '../../utils/output';

const VIEW_LOGS_MESSAGE = `Hint: Try "buildscale view-logs" to get structured, searchable errors logs in your browser.`;

export function viewLogsFooterRows(failedTasks: number) {
  if (failedTasks >= 2 && !isBuildscaleCloudUsed(readBuildscaleJson())) {
    return [``, output.dim(` ${VIEW_LOGS_MESSAGE}`)];
  } else {
    return [];
  }
}
