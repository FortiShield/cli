import * as chalk from 'chalk';
import { output } from '../output';
import type { CorePlugin, PluginCapabilities } from './models';

export function fetchCorePlugins(): CorePlugin[] {
  return [
    {
      name: '@buildscale/angular',
      capabilities: 'executors,generators',
    },
    {
      name: '@buildscale/cypress',
      capabilities: 'executors,generators',
    },
    {
      name: '@buildscale/detox',
      capabilities: 'executors,generators',
    },
    {
      name: '@buildscale/esbuild',
      capabilities: 'executors,generators',
    },
    {
      name: '@buildscale/expo',
      capabilities: 'executors,generators',
    },
    {
      name: '@buildscale/express',
      capabilities: 'generators',
    },
    {
      name: '@buildscale/jest',
      capabilities: 'executors,generators',
    },
    {
      name: '@buildscale/js',
      capabilities: 'executors,generators',
    },
    {
      name: '@buildscale/eslint',
      capabilities: 'executors,generators',
    },
    {
      name: '@buildscale/nest',
      capabilities: 'generators',
    },
    {
      name: '@buildscale/next',
      capabilities: 'executors,generators',
    },
    {
      name: '@buildscale/node',
      capabilities: 'executors,generators',
    },
    {
      name: '@buildscale/nuxt',
      capabilities: 'generators',
    },
    {
      name: 'buildscale',
      capabilities: 'executors',
    },
    {
      name: '@buildscale/plugin',
      capabilities: 'executors,generators',
    },
    {
      name: '@buildscale/react',
      capabilities: 'executors,generators',
    },
    {
      name: '@buildscale/react-native',
      capabilities: 'executors,generators',
    },
    {
      name: '@buildscale/remix',
      capabilities: 'executors,generators',
    },
    {
      name: '@buildscale/rollup',
      capabilities: 'executors,generators',
    },
    {
      name: '@buildscale/storybook',
      capabilities: 'executors,generators',
    },
    {
      name: '@buildscale/vite',
      capabilities: 'executors,generators',
    },
    {
      name: '@buildscale/web',
      capabilities: 'executors,generators',
    },
    {
      name: '@buildscale/webpack',
      capabilities: 'executors,generators',
    },
    {
      name: '@buildscale/workspace',
      capabilities: 'executors,generators',
    },
  ];
}

export function listCorePlugins(
  installedPlugins: Map<string, PluginCapabilities>,
  corePlugins: CorePlugin[]
): void {
  const alsoAvailable = corePlugins.filter(
    (p) => !installedPlugins.has(p.name)
  );

  if (alsoAvailable.length) {
    output.log({
      title: `Also available:`,
      bodyLines: alsoAvailable.map((p) => {
        return `${chalk.bold(p.name)} (${p.capabilities})`;
      }),
    });
  }
}
