import { CommandModule } from 'yargs';
import { linkToBuildscaleDevAndExamples } from '../yargs-utils/documentation';
import {
  withRunManyOptions,
  withOutputStyleOption,
  withTargetAndConfigurationOption,
  withOverrides,
  withBatch,
} from '../yargs-utils/shared-options';
import { handleErrors } from '../../utils/params';

export const yargsRunManyCommand: CommandModule = {
  command: 'run-many',
  describe: 'Run target for multiple listed projects',
  builder: (yargs) =>
    linkToBuildscaleDevAndExamples(
      withRunManyOptions(
        withOutputStyleOption(
          withTargetAndConfigurationOption(withBatch(yargs))
        )
      ),
      'run-many'
    ),
  handler: async (args) =>
    await handleErrors(
      (args.verbose as boolean) ?? process.env.BUILDSCALE_VERBOSE_LOGGING === 'true',
      async () => {
        (await import('./run-many')).runMany(withOverrides(args));
      }
    ),
};
