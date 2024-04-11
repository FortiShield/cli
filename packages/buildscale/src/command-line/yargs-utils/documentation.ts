import chalk = require('chalk');
import yargs = require('yargs');
import { examples } from '../examples';

export function linkToBuildscaleDevAndExamples<T>(
  yargs: yargs.Argv<T>,
  command: string
) {
  (examples[command] || []).forEach((t) => {
    yargs = yargs.example(t.command, t.description);
  });
  return yargs.epilog(
    chalk.bold(
      `Find more information and examples at https://buildscale.github.io/buildscale/${command.replace(
        ':',
        '-'
      )}`
    )
  );
}
