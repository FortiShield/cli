import { performance } from 'perf_hooks';

import { commandsObject } from '../src/command-line/buildscale-commands';
import { WorkspaceTypeAndRoot } from '../src/utils/find-workspace-root';
import { stripIndents } from '../src/utils/strip-indents';

import * as Mod from 'module';

/**
 * Buildscale is being run inside a workspace.
 *
 * @param workspace Relevant local workspace properties
 */

export function initLocal(workspace: WorkspaceTypeAndRoot) {
  process.env.BUILDSCALE_CLI_SET = 'true';

  try {
    performance.mark('init-local');

    monkeyPatchRequire();

    if (workspace.type !== 'buildscale' && shouldDelegateToAngularCLI()) {
      console.warn(
        stripIndents`Using Buildscale to run Angular CLI commands is deprecated and will be removed in a future version.
        To run Angular CLI commands, use \`ng\`.`
      );
      handleAngularCLIFallbacks(workspace);
      return;
    }

    const command = process.argv[2];
    if (command === 'run' || command === 'g' || command === 'generate') {
      commandsObject.parse(process.argv.slice(2));
    } else if (isKnownCommand(command)) {
      const newArgs = rewriteTargetsAndProjects(process.argv);
      const help = newArgs.indexOf('--help');
      const split = newArgs.indexOf('--');
      if (help > -1 && (split === -1 || split > help)) {
        commandsObject.showHelp();
      } else {
        commandsObject.parse(newArgs);
      }
    } else {
      commandsObject.parse(process.argv.slice(2));
    }
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

export function rewriteTargetsAndProjects(args: string[]) {
  const newArgs = [args[2]];
  let i = 3;
  while (i < args.length) {
    if (args[i] === '--') {
      return [...newArgs, ...args.slice(i)];
    } else if (
      args[i] === '-p' ||
      args[i] === '--projects' ||
      args[i] === '--exclude' ||
      args[i] === '--files' ||
      args[i] === '-t' ||
      args[i] === '--target' ||
      args[i] === '--targets'
    ) {
      newArgs.push(args[i]);
      i++;
      const items = [];
      while (i < args.length && !args[i].startsWith('-')) {
        items.push(args[i]);
        i++;
      }
      newArgs.push(items.join(','));
    } else {
      newArgs.push(args[i]);
      ++i;
    }
  }
  return newArgs;
}

function wrapIntoQuotesIfNeeded(arg: string) {
  return arg.indexOf(':') > -1 ? `"${arg}"` : arg;
}

function isKnownCommand(command: string) {
  const commands = [
    ...Object.keys(
      (commandsObject as any)
        .getInternalMethods()
        .getCommandInstance()
        .getCommandHandlers()
    ),
    'g',
    'dep-graph',
    'affected:dep-graph',
    'format',
    'workspace-schematic',
    'connect-to-buildscale-cloud',
    'clear-cache',
    'help',
  ];
  return !command || command.startsWith('-') || commands.indexOf(command) > -1;
}

function shouldDelegateToAngularCLI() {
  const command = process.argv[2];
  const commands = [
    'analytics',
    'cache',
    'completion',
    'config',
    'doc',
    'update',
  ];
  return commands.indexOf(command) > -1;
}

function handleAngularCLIFallbacks(workspace: WorkspaceTypeAndRoot) {
  if (process.argv[2] === 'update' && process.env.FORCE_NG_UPDATE != 'true') {
    console.log(
      `Buildscale provides a much improved version of "ng update". It runs the same migrations, but allows you to:`
    );
    console.log(`- rerun the same migration multiple times`);
    console.log(`- reorder migrations, skip migrations`);
    console.log(`- fix migrations that "almost work"`);
    console.log(`- commit a partially migrated state`);
    console.log(
      `- change versions of packages to match organizational requirements`
    );
    console.log(
      `And, in general, it is lot more reliable for non-trivial workspaces. Read more at: https://buildscale.github.io/getting-started/buildscale-and-angular#ng-update-and-buildscale-migrate`
    );
    console.log(
      `Run "buildscale migrate latest" to update to the latest version of Buildscale.`
    );
    console.log(
      `Running "ng update" can still be useful in some dev workflows, so we aren't planning to remove it.`
    );
    console.log(`If you need to use it, run "FORCE_NG_UPDATE=true ng update".`);
  } else if (process.argv[2] === 'completion') {
    if (!process.argv[3]) {
      console.log(`"ng completion" is not natively supported by Buildscale.
  Instead, you could try an Buildscale Editor Plugin for a visual tool to run Buildscale commands. If you're using VSCode, you can use the Buildscale Console plugin, or if you're using WebStorm, you could use one of the available community plugins.
  For more information, see https://buildscale.github.io/getting-started/editor-setup`);
    }
  } else if (process.argv[2] === 'cache') {
    console.log(`"ng cache" is not natively supported by Buildscale.
To clear the cache, you can delete the ".angular/cache" directory (or the directory configured by "cli.cache.path" in the "buildscale.json" file).
To update the cache configuration, you can directly update the relevant options in your "buildscale.json" file (https://angular.io/guide/workspace-config#cache-options).`);
  } else {
    try {
      // buildscale-ignore-next-line
      const cli = require.resolve('@angular/cli/lib/init.js', {
        paths: [workspace.dir],
      });
      require(cli);
    } catch (e) {
      console.error(
        `Could not find '@angular/cli/lib/init.js' module in this workspace.`,
        e
      );
      process.exit(1);
    }
  }
}

// TODO(v17): Remove this once the @nrwl/* packages are not
function monkeyPatchRequire() {
  const originalRequire = Mod.prototype.require;

  (Mod.prototype.require as any) = function (...args) {
    const modulePath = args[0];
    if (!modulePath.startsWith('@nrwl/')) {
      return originalRequire.apply(this, args);
    } else {
      try {
        // Try the original require
        return originalRequire.apply(this, args);
      } catch (e) {
        if (e.code !== 'MODULE_NOT_FOUND') {
          throw e;
        }

        try {
          // Retry the require with the @buildscale package
          return originalRequire.apply(
            this,
            args.map((value, i) => {
              if (i !== 0) {
                return value;
              } else {
                return value.replace('@nrwl/', '@buildscale/');
              }
            })
          );
        } catch {
          // Throw the original error
          throw e;
        }
      }
    }
    // do some side-effect of your own
  };
}
