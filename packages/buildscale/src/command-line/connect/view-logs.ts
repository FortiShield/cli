import { getPackageManagerCommand } from '../../utils/package-manager';
import { execSync } from 'child_process';
import { isBuildscaleCloudUsed } from '../../utils/buildscale-cloud-utils';
import { output } from '../../utils/output';
import { runBuildscaleSync } from '../../utils/child-process';
import { readBuildscaleJson } from '../../config/buildscale-json';
import { connectExistingRepoToBuildscaleCloudPrompt } from './connect-to-buildscale-cloud';

export async function viewLogs(): Promise<number> {
  const cloudUsed = isBuildscaleCloudUsed(readBuildscaleJson());
  if (cloudUsed) {
    output.error({
      title: 'Your workspace is already connected to Buildscale Cloud',
      bodyLines: [
        `Refer to the output of the last command to find the Buildscale Cloud link to view the run details.`,
      ],
    });
    return 1;
  }

  const setupBuildscaleCloud = await connectExistingRepoToBuildscaleCloudPrompt(
    'setupViewLogs'
  );
  if (!setupBuildscaleCloud) {
    return;
  }

  try {
    output.log({
      title: 'Connecting to Buildscale Cloud',
    });
    runBuildscaleSync(
      `g buildscale:connect-to-buildscale-cloud --installation-source=view-logs --quiet --no-interactive`,
      {
        stdio: 'ignore',
      }
    );
  } catch (e) {
    output.log({
      title: 'Failed to connect to Buildscale Cloud',
    });
    console.log(e);
    return 1;
  }

  const pmc = getPackageManagerCommand();
  execSync(`${pmc.exec} buildscale-cloud upload-and-show-run-details`, {
    stdio: [0, 1, 2],
  });

  if (!cloudUsed) {
    output.note({
      title: 'Your workspace is now connected to Buildscale Cloud',
      bodyLines: [`Learn more about Buildscale Cloud at https://buildscale.app`],
    });
  }
  return 0;
}
