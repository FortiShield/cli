import { CommandModule } from 'yargs';

export interface AddOptions {
  packageSpecifier: string;
  updatePackageScripts?: boolean;
  verbose?: boolean;
}

export const yargsAddCommand: CommandModule<
  Record<string, unknown>,
  AddOptions
> = {
  command: 'add <packageSpecifier>',
  describe: 'Install a plugin and initialize it.',
  builder: (yargs) =>
    yargs
      .positional('packageSpecifier', {
        type: 'string',
        description:
          'The package name and optional version (e.g. `@buildscale/react` or `@buildscale/react@latest`) to install and initialize. If the version is not specified it will install the same version as the `buildscale` package for Buildscale core plugins or the latest version for other packages',
      })
      .option('updatePackageScripts', {
        type: 'boolean',
        description:
          'Update `package.json` scripts with inferred targets. Defaults to `true` when the package is a core Buildscale plugin',
      })
      .option('verbose', {
        type: 'boolean',
        description:
          'Prints additional information about the commands (e.g., stack traces)',
      })
      .example(
        '$0 add @buildscale/react',
        'Install the latest version of the `@buildscale/react` package and run its `@buildscale/react:init` generator'
      )
      .example(
        '$0 add non-core-buildscale-plugin',
        'Install the latest version of the `non-core-buildscale-plugin` package and run its `non-core-buildscale-plugin:init` generator if available'
      )
      .example(
        '$0 add @buildscale/react@17.0.0',
        'Install version `17.0.0` of the `@buildscale/react` package and run its `@buildscale/react:init` generator'
      ) as any,
  handler: (args) => import('./add').then((m) => m.addHandler(args)),
};
