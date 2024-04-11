import { CommandModule } from 'yargs';

export const yargsResetCommand: CommandModule = {
  command: 'reset',
  describe:
    'Clears all the cached Buildscale artifacts and metadata about the workspace and shuts down the Buildscale Daemon.',
  aliases: ['clear-cache'],
  handler: async () => (await import('./reset')).resetHandler(),
};
