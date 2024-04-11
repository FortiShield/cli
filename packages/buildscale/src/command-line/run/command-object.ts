import { CommandModule } from 'yargs';
import {
  withBatch,
  withOverrides,
  withRunOneOptions,
} from '../yargs-utils/shared-options';
import { handleErrors } from '../../utils/params';

export const yargsRunCommand: CommandModule = {
  command: 'run [project][:target][:configuration] [_..]',
  describe: `Run a target for a project
    (e.g., buildscale run myapp:serve:production).

    You can also use the infix notation to run a target:
    (e.g., buildscale serve myapp --configuration=production)

    You can skip the use of Buildscale cache by using the --skip-buildscale-cache option.`,
  builder: (yargs) => withRunOneOptions(withBatch(yargs)),
  handler: async (args) =>
    await handleErrors(
      (args.verbose as boolean) ?? process.env.BUILDSCALE_VERBOSE_LOGGING === 'true',
      async () => {
        (await import('./run-one')).runOne(process.cwd(), withOverrides(args));
      }
    ),
};

/**
 * Handles the infix notation for running a target.
 */
export const yargsBuildscaleInfixCommand: CommandModule = {
  ...yargsRunCommand,
  command: '$0 <target> [project] [_..]',
  describe: 'Run a target for a project',
  handler: async (args) => {
    await handleErrors(
      (args.verbose as boolean) ?? process.env.BUILDSCALE_VERBOSE_LOGGING === 'true',
      async () => {
        return (await import('./run-one')).runOne(
          process.cwd(),
          withOverrides(args, 0)
        );
      }
    );
  },
};
