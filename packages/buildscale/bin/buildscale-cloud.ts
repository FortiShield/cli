#!/usr/bin/env node

import { findAncestorNodeModules } from '../src/buildscale-cloud/resolution-helpers';
import { getCloudOptions } from '../src/buildscale-cloud/utilities/get-cloud-options';
import {
  BuildscaleCloudClientUnavailableError,
  BuildscaleCloudEnterpriseOutdatedError,
  verifyOrUpdateBuildscaleCloudClient,
} from '../src/buildscale-cloud/update-manager';
import type { CloudTaskRunnerOptions } from '../src/buildscale-cloud/buildscale-cloud-tasks-runner-shell';
import { output } from '../src/utils/output';

const command = process.argv[2];

const options = getCloudOptions();

Promise.resolve().then(async () => invokeCommandWithBuildscaleCloudClient(options));

async function invokeCommandWithBuildscaleCloudClient(options: CloudTaskRunnerOptions) {
  try {
    const { buildscaleCloudClient } = await verifyOrUpdateBuildscaleCloudClient(options);

    const paths = findAncestorNodeModules(__dirname, []);
    buildscaleCloudClient.configureLightClientRequire()(paths);

    if (command in buildscaleCloudClient.commands) {
      buildscaleCloudClient.commands[command]()
        .then(() => process.exit(0))
        .catch((e) => {
          console.error(e);
          process.exit(1);
        });
    } else {
      output.error({
        title: `Unknown Command "${command}"`,
      });
      output.log({
        title: 'Available Commands:',
        bodyLines: Object.keys(buildscaleCloudClient.commands).map((c) => `- ${c}`),
      });
      process.exit(1);
    }
  } catch (e: any) {
    const body = ['Cannot run commands from the `buildscale-cloud` CLI.'];

    if (e instanceof BuildscaleCloudEnterpriseOutdatedError) {
      try {
        // TODO: Remove this when all enterprise customers have updated.
        // Try requiring the bin from the `buildscale-cloud` package.
        return require('buildscale-cloud/bin/buildscale-cloud');
      } catch {}
      body.push(
        'If you are an BuildScale Enterprise customer, please reach out to your assigned Developer Productivity Engineer.',
        'If you are NOT an BuildScale Enterprise customer but are seeing this message, please reach out to cloud-support@nrwl.io.'
      );
    }

    if (e instanceof BuildscaleCloudClientUnavailableError) {
      body.unshift(
        'You may be offline. Please try again when you are back online.'
      );
    }

    output.error({
      title: e.message,
      bodyLines: body,
    });
    process.exit(1);
  }
}
