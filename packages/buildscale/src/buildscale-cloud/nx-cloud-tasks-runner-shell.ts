import { findAncestorNodeModules } from './resolution-helpers';
import {
  BuildscaleCloudClientUnavailableError,
  BuildscaleCloudEnterpriseOutdatedError,
  verifyOrUpdateBuildscaleCloudClient,
} from './update-manager';
import {
  defaultTasksRunner,
  DefaultTasksRunnerOptions,
} from '../tasks-runner/default-tasks-runner';
import { TasksRunner } from '../tasks-runner/tasks-runner';
import { output } from '../utils/output';
import { Task } from '../config/task-graph';

export interface CloudTaskRunnerOptions extends DefaultTasksRunnerOptions {
  accessToken?: string;
  canTrackAnalytics?: boolean;
  encryptionKey?: string;
  maskedProperties?: string[];
  showUsageWarnings?: boolean;
  customProxyConfigPath?: string;
  useLatestApi?: boolean;
  url?: string;
  useLightClient?: boolean;
  clientVersion?: string;
}

export const buildscaleCloudTasksRunnerShell: TasksRunner<
  CloudTaskRunnerOptions
> = async (tasks: Task[], options: CloudTaskRunnerOptions, context) => {
  try {
    const { buildscaleCloudClient, version } = await verifyOrUpdateBuildscaleCloudClient(
      options
    );

    options.clientVersion = version;

    const paths = findAncestorNodeModules(__dirname, []);
    buildscaleCloudClient.configureLightClientRequire()(paths);

    return buildscaleCloudClient.buildscaleCloudTasksRunner(tasks, options, context);
  } catch (e: any) {
    const body =
      e instanceof BuildscaleCloudEnterpriseOutdatedError
        ? [
            'If you are an BuildScale Enterprise customer, please reach out to your assigned Developer Productivity Engineer.',
            'If you are NOT an BuildScale Enterprise customer but are seeing this message, please reach out to cloud-support@nrwl.io.',
          ]
        : e instanceof BuildscaleCloudClientUnavailableError
        ? [
            'You might be offline. Buildscale Cloud will be re-enabled when you are back online.',
          ]
        : [];

    if (e instanceof BuildscaleCloudEnterpriseOutdatedError) {
      output.warn({
        title: e.message,
        bodyLines: ['Buildscale Cloud will not used for this command.', ...body],
      });
    }
    const results = await defaultTasksRunner(tasks, options, context);
    output.warn({
      title: e.message,
      bodyLines: ['Buildscale Cloud was not used for this command.', ...body],
    });
    return results;
  }
};
