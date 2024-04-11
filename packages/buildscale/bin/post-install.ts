import { buildProjectGraphAndSourceMapsWithoutDaemon } from '../src/project-graph/project-graph';
import { workspaceRoot } from '../src/utils/workspace-root';
import { fileExists } from '../src/utils/fileutils';
import { join } from 'path';
import { daemonClient } from '../src/daemon/client/client';
import { assertSupportedPlatform } from '../src/native/assert-supported-platform';
import { verifyOrUpdateBuildscaleCloudClient } from '../src/buildscale-cloud/update-manager';
import { getCloudOptions } from '../src/buildscale-cloud/utilities/get-cloud-options';
import { isBuildscaleCloudUsed } from '../src/utils/buildscale-cloud-utils';
import { readBuildscaleJson } from '../src/config/buildscale-json';
import { setupWorkspaceContext } from '../src/utils/workspace-context';

(async () => {
  const start = new Date();
  try {
    setupWorkspaceContext(workspaceRoot);
    if (isMainBuildscalePackage() && fileExists(join(workspaceRoot, 'buildscale.json'))) {
      assertSupportedPlatform();

      try {
        await daemonClient.stop();
      } catch (e) {}
      const tasks: Array<Promise<any>> = [
        buildProjectGraphAndSourceMapsWithoutDaemon(),
      ];
      if (isBuildscaleCloudUsed(readBuildscaleJson())) {
        tasks.push(verifyOrUpdateBuildscaleCloudClient(getCloudOptions()));
      }
      await Promise.all(
        tasks.map((promise) => {
          promise.catch((e) => {
            if (process.env.BUILDSCALE_VERBOSE_LOGGING === 'true') {
              console.warn(e);
            }
          });
        })
      );
    }
  } catch (e) {
    if (process.env.BUILDSCALE_VERBOSE_LOGGING === 'true') {
      console.log(e);
    }
  } finally {
    if (process.env.BUILDSCALE_VERBOSE_LOGGING === 'true') {
      const end = new Date();
      console.log(
        `Buildscale postinstall steps took ${end.getTime() - start.getTime()}ms`
      );
    }
  }
})();

function isMainBuildscalePackage() {
  const mainBuildscalePath = require.resolve('buildscale', {
    paths: [workspaceRoot],
  });
  const thisBuildscalePath = require.resolve('buildscale');
  return mainBuildscalePath === thisBuildscalePath;
}
