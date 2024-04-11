import { CommandModule } from 'yargs';
import { linkToBuildscaleDevAndExamples } from '../yargs-utils/documentation';
import {
  withAffectedOptions,
  withBatch,
  withConfiguration,
  withDepGraphOptions,
  withOutputStyleOption,
  withOverrides,
  withRunOptions,
  withTargetAndConfigurationOption,
} from '../yargs-utils/shared-options';
import { handleErrors } from '../../utils/params';

export const yargsAffectedCommand: CommandModule = {
  command: 'affected',
  describe: 'Run target for affected projects',
  builder: (yargs) =>
    linkToBuildscaleDevAndExamples(
      withAffectedOptions(
        withRunOptions(
          withOutputStyleOption(
            withTargetAndConfigurationOption(withBatch(yargs))
          )
        )
      )
        .option('all', {
          type: 'boolean',
          deprecated: 'Use `buildscale run-many` instead',
        })
        .middleware((args) => {
          if (args.all !== undefined) {
            throw new Error(
              "The '--all' option has been removed for `buildscale affected`. Use 'buildscale run-many' instead."
            );
          }
        }),
      'affected'
    ),
  handler: async (args) => {
    return handleErrors(
      (args.verbose as boolean) ?? process.env.BUILDSCALE_VERBOSE_LOGGING === 'true',
      async () => {
        return (await import('./affected')).affected(
          'affected',
          withOverrides(args)
        );
      }
    );
  },
};

export const yargsAffectedTestCommand: CommandModule = {
  command: 'affected:test',
  describe: false,
  builder: (yargs) =>
    linkToBuildscaleDevAndExamples(
      withAffectedOptions(
        withRunOptions(withOutputStyleOption(withConfiguration(yargs)))
      ),
      'affected'
    ),
  handler: async (args) => {
    return handleErrors(
      (args.verbose as boolean) ?? process.env.BUILDSCALE_VERBOSE_LOGGING === 'true',
      async () => {
        return (await import('./affected')).affected('affected', {
          ...withOverrides(args),
          target: 'test',
        });
      }
    );
  },
};

export const yargsAffectedBuildCommand: CommandModule = {
  command: 'affected:build',
  describe: false,
  builder: (yargs) =>
    linkToBuildscaleDevAndExamples(
      withAffectedOptions(
        withRunOptions(withOutputStyleOption(withConfiguration(yargs)))
      ),
      'affected'
    ),
  handler: async (args) => {
    return handleErrors(
      (args.verbose as boolean) ?? process.env.BUILDSCALE_VERBOSE_LOGGING === 'true',
      async () => {
        return (await import('./affected')).affected('affected', {
          ...withOverrides(args),
          target: 'build',
        });
      }
    );
  },
};

export const yargsAffectedLintCommand: CommandModule = {
  command: 'affected:lint',
  describe: false,
  builder: (yargs) =>
    linkToBuildscaleDevAndExamples(
      withAffectedOptions(
        withRunOptions(withOutputStyleOption(withConfiguration(yargs)))
      ),
      'affected'
    ),
  handler: async (args) => {
    return handleErrors(
      (args.verbose as boolean) ?? process.env.BUILDSCALE_VERBOSE_LOGGING === 'true',
      async () => {
        return (await import('./affected')).affected('affected', {
          ...withOverrides(args),
          target: 'lint',
        });
      }
    );
  },
};

export const yargsAffectedE2ECommand: CommandModule = {
  command: 'affected:e2e',
  describe: false,
  builder: (yargs) =>
    linkToBuildscaleDevAndExamples(
      withAffectedOptions(
        withRunOptions(withOutputStyleOption(withConfiguration(yargs)))
      ),
      'affected'
    ),
  handler: async (args) => {
    return handleErrors(
      (args.verbose as boolean) ?? process.env.BUILDSCALE_VERBOSE_LOGGING === 'true',
      async () => {
        return (await import('./affected')).affected('affected', {
          ...withOverrides(args),
          target: 'e2e',
        });
      }
    );
  },
};

export const affectedGraphDeprecationMessage =
  'Use `buildscale graph --affected`, or `buildscale affected --graph` instead depending on which best suits your use case. The `affected:graph` command will be removed in Buildscale 19.';
/**
 * @deprecated 'Use `buildscale graph --affected`, or` buildscale affected --graph` instead depending on which best suits your use case. The `affected:graph` command will be removed in Buildscale 19.'
 */
export const yargsAffectedGraphCommand: CommandModule = {
  command: 'affected:graph',
  describe: 'Graph dependencies affected by changes',
  aliases: ['affected:dep-graph'],
  builder: (yargs) =>
    linkToBuildscaleDevAndExamples(
      withAffectedOptions(withDepGraphOptions(yargs)),
      'affected:graph'
    ),
  handler: async (args) => {
    return handleErrors(
      (args.verbose as boolean) ?? process.env.BUILDSCALE_VERBOSE_LOGGING === 'true',
      async () => {
        return await (
          await import('./affected')
        ).affected('graph', {
          ...args,
        });
      }
    );
  },
  deprecated: affectedGraphDeprecationMessage,
};

export const printAffectedDeprecationMessage =
  'Use `buildscale show projects --affected`, `buildscale affected --graph -t build` or `buildscale graph --affected` depending on which best suits your use case. The `print-affected` command will be removed in Buildscale 19.';
/**
 * @deprecated 'Use `buildscale show --affected`, `buildscale affected --graph` or `buildscale graph --affected` depending on which best suits your use case. The `print-affected` command will be removed in Buildscale 19.'
 */
export const yargsPrintAffectedCommand: CommandModule = {
  command: 'print-affected',
  describe:
    'Prints information about the projects and targets affected by changes',
  builder: (yargs) =>
    linkToBuildscaleDevAndExamples(
      withAffectedOptions(withTargetAndConfigurationOption(yargs, false)),
      'print-affected'
    )
      .option('select', {
        type: 'string',
        describe:
          'Select the subset of the returned json document (e.g., --select=projects)',
      })
      .option('type', {
        type: 'string',
        choices: ['app', 'lib'],
        describe:
          'Select the type of projects to be returned (e.g., --type=app)',
      }),
  handler: async (args) => {
    return handleErrors(
      (args.verbose as boolean) ?? process.env.BUILDSCALE_VERBOSE_LOGGING === 'true',
      async () => {
        await (
          await import('./affected')
        ).affected('print-affected', withOverrides(args));
        process.exit(0);
      }
    );
  },
  deprecated: printAffectedDeprecationMessage,
};
