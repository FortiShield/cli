import { rmSync } from 'fs-extra';
import { daemonClient } from '../../daemon/client/client';
import {
  cacheDir,
  projectGraphCacheDirectory,
} from '../../utils/cache-directory';
import { output } from '../../utils/output';

export async function resetHandler() {
  output.note({
    title: 'Resetting the Buildscale workspace cache and stopping the Buildscale Daemon.',
    bodyLines: [`This might take a few minutes.`],
  });
  await daemonClient.stop();
  output.log({ title: 'Daemon Server - Stopped' });
  rmSync(cacheDir, { recursive: true, force: true });
  if (projectGraphCacheDirectory !== cacheDir) {
    rmSync(projectGraphCacheDirectory, { recursive: true, force: true });
  }
  output.success({
    title: 'Successfully reset the Buildscale workspace.',
  });
}
