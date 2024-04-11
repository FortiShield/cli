import { CommandModule, Argv } from 'yargs';
import { linkToBuildscaleDevAndExamples } from '../yargs-utils/documentation';

export const yargsDaemonCommand: CommandModule = {
  command: 'daemon',
  describe:
    'Prints information about the Buildscale Daemon process or starts a daemon process',
  builder: (yargs) =>
    linkToBuildscaleDevAndExamples(withDaemonOptions(yargs), 'daemon'),
  handler: async (args) => (await import('./daemon')).daemonHandler(args),
};

function withDaemonOptions(yargs: Argv): Argv {
  return yargs
    .option('start', {
      type: 'boolean',
      default: false,
    })
    .option('stop', {
      type: 'boolean',
      default: false,
    });
}
