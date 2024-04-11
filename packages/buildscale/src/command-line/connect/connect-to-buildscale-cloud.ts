import { output } from '../../utils/output';
import { readBuildscaleJson } from '../../config/configuration';
import { getBuildscaleCloudUrl, isBuildscaleCloudUsed } from '../../utils/buildscale-cloud-utils';
import { runBuildscaleSync } from '../../utils/child-process';
import { BuildscaleJsonConfiguration } from '../../config/buildscale-json';
import { BuildscaleArgs } from '../../utils/command-line-utils';
import {
  MessageKey,
  MessageOptionKey,
  recordStat,
  messages,
} from '../../utils/ab-testing';
import { buildscaleVersion } from '../../utils/versions';
import chalk = require('chalk');

export function onlyDefaultRunnerIsUsed(buildscaleJson: BuildscaleJsonConfiguration) {
  const defaultRunner = buildscaleJson.tasksRunnerOptions?.default?.runner;

  if (!defaultRunner) {
    // No tasks runner options OR no default runner defined:
    // - If access token defined, uses cloud runner
    // - If no access token defined, uses default
    return !(buildscaleJson.buildscaleCloudAccessToken ?? process.env.BUILDSCALE_CLOUD_ACCESS_TOKEN);
  }

  return defaultRunner === 'buildscale/tasks-runners/default';
}

export async function connectToBuildscaleCloudIfExplicitlyAsked(
  opts: BuildscaleArgs
): Promise<void> {
  if (opts['cloud'] === true) {
    const buildscaleJson = readBuildscaleJson();
    if (!onlyDefaultRunnerIsUsed(buildscaleJson)) return;

    output.log({
      title: '--cloud requires the workspace to be connected to Buildscale Cloud.',
    });
    runBuildscaleSync(`connect-to-buildscale-cloud`, {
      stdio: [0, 1, 2],
    });
    output.success({
      title: 'Your workspace has been successfully connected to Buildscale Cloud.',
    });
    process.exit(0);
  }
}

export async function connectToBuildscaleCloudCommand(): Promise<boolean> {
  const buildscaleJson = readBuildscaleJson();
  if (isBuildscaleCloudUsed(buildscaleJson)) {
    output.log({
      title: '✔ This workspace already has Buildscale Cloud set up',
      bodyLines: [
        'If you have not done so already, connect your workspace to your Buildscale Cloud account:',
        `- Login at ${getBuildscaleCloudUrl(buildscaleJson)} to connect your repository`,
      ],
    });
    return false;
  }

  runBuildscaleSync(`g buildscale:connect-to-buildscale-cloud --quiet --no-interactive`, {
    stdio: [0, 1, 2],
  });
  return true;
}

export async function connectToBuildscaleCloudWithPrompt(command: string) {
  const setBuildscaleCloud = await buildscaleCloudPrompt('setupBuildscaleCloud');
  const useCloud =
    setBuildscaleCloud === 'yes' ? await connectToBuildscaleCloudCommand() : false;
  await recordStat({
    command,
    buildscaleVersion,
    useCloud,
    meta: messages.codeOfSelectedPromptMessage('setupBuildscaleCloud'),
  });
}

export async function connectExistingRepoToBuildscaleCloudPrompt(
  key: MessageKey = 'setupBuildscaleCloud'
): Promise<boolean> {
  return buildscaleCloudPrompt(key).then((value: MessageOptionKey) => value === 'yes');
}

async function buildscaleCloudPrompt(key: MessageKey): Promise<MessageOptionKey> {
  const { message, choices, initial, footer, hint } = messages.getPrompt(key);

  const promptConfig = {
    name: 'BuildscaleCloud',
    message,
    type: 'autocomplete',
    choices,
    initial,
  } as any; // meeroslav: types in enquirer are not up to date
  if (footer) {
    promptConfig.footer = () => chalk.dim(footer);
  }
  if (hint) {
    promptConfig.hint = () => chalk.dim(hint);
  }

  return await (await import('enquirer'))
    .prompt<{ BuildscaleCloud: MessageOptionKey }>([promptConfig])
    .then((a) => {
      return a.BuildscaleCloud;
    });
}
