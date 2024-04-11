import { CommandModule } from 'yargs';
import { linkToBuildscaleDevAndExamples } from '../yargs-utils/documentation';

export const yargsConnectCommand: CommandModule = {
  command: 'connect',
  aliases: ['connect-to-buildscale-cloud'],
  describe: `Connect workspace to Buildscale Cloud`,
  builder: (yargs) => linkToBuildscaleDevAndExamples(yargs, 'connect-to-buildscale-cloud'),
  handler: async () => {
    await (await import('./connect-to-buildscale-cloud')).connectToBuildscaleCloudCommand();
    process.exit(0);
  },
};

export const yargsViewLogsCommand: CommandModule = {
  command: 'view-logs',
  describe:
    'Enables you to view and interact with the logs via the advanced analytic UI from Buildscale Cloud to help you debug your issue. To do this, Buildscale needs to connect your workspace to Buildscale Cloud and upload the most recent run details. Only the metrics are uploaded, not the artefacts.',
  handler: async () =>
    process.exit(await (await import('./view-logs')).viewLogs()),
};
