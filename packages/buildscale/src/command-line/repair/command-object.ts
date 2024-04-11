import { ArgumentsCamelCase, CommandModule } from 'yargs';
import { linkToBuildscaleDevAndExamples } from '../yargs-utils/documentation';

export const yargsRepairCommand: CommandModule = {
  command: 'repair',
  describe: `Repair any configuration that is no longer supported by Buildscale.

    Specifically, this will run every migration within the \`buildscale\` package
    against the current repository. Doing so should fix any configuration
    details left behind if the repository was previously updated to a new
    Buildscale version without using \`buildscale migrate\`.

    If your repository has only ever updated to newer versions of Buildscale with
    \`buildscale migrate\`, running \`buildscale repair\` should do nothing.
  `,
  builder: (yargs) =>
    linkToBuildscaleDevAndExamples(yargs, 'repair').option('verbose', {
      type: 'boolean',
      describe:
        'Prints additional information about the commands (e.g., stack traces)',
    }),
  handler: async (args: ArgumentsCamelCase<{ verbose: boolean }>) =>
    process.exit(await (await import('./repair')).repair(args)),
};
