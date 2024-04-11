import { updateJson } from '../../generators/utils/json';
import { Tree } from '../../generators/tree';
import { BuildscaleJsonConfiguration } from '../../config/buildscale-json';
import { PackageJson } from '../../utils/package-json';
import { formatChangedFilesWithPrettierIfAvailable } from '../../generators/internal-utils/format-changed-files-with-prettier-if-available';
import { readBuildscaleJson } from '../../generators/utils/buildscale-json';
import {
  BuildscaleCloudEnterpriseOutdatedError,
  verifyOrUpdateBuildscaleCloudClient,
} from '../../buildscale-cloud/update-manager';
import { getRunnerOptions } from '../../tasks-runner/run-command';
import { output } from '../../utils/output';

export default async function migrate(tree: Tree) {
  if (!tree.exists('buildscale.json')) {
    return;
  }

  const buildscaleJson = readBuildscaleJson(tree);

  // Already migrated
  if (!buildscaleJson.tasksRunnerOptions?.default) {
    return;
  }

  const buildscaleCloudClientSupported = await isBuildscaleCloudClientSupported(buildscaleJson);
  updateJson<BuildscaleJsonConfiguration>(tree, 'buildscale.json', (buildscaleJson) => {
    const { runner, options } = buildscaleJson.tasksRunnerOptions.default;

    // This property shouldn't ever be part of tasks runner options.
    if (options.useDaemonProcess !== undefined) {
      buildscaleJson.useDaemonProcess = options.useDaemonProcess;
      delete options.useDaemonProcess;
    }

    // Remaining keys may be specific to a given runner, so leave them alone if there are multiple runners.
    if (Object.keys(buildscaleJson.tasksRunnerOptions ?? {}).length > 1) {
      return buildscaleJson;
    }

    // These options can only be moved for buildscale-cloud.
    if (runner === 'buildscale-cloud' || runner === '@nrwl/buildscale-cloud') {
      buildscaleJson.buildscaleCloudAccessToken = options.accessToken;
      delete options.accessToken;

      if (options.url) {
        buildscaleJson.buildscaleCloudUrl = options.url;
        delete options.url;
      }

      if (buildscaleCloudClientSupported) {
        removeBuildscaleCloudDependency(tree);
      } else {
        options.useLightClient = false;
      }
      if (options.encryptionKey) {
        buildscaleJson.buildscaleCloudEncryptionKey = options.encryptionKey;
        delete options.encryptionKey;
      }
    }

    // These options should be safe to move for all tasks runners:
    if (options.parallel !== undefined) {
      buildscaleJson.parallel = options.parallel;
      delete options.parallel;
    }
    if (options.cacheDirectory !== undefined) {
      buildscaleJson.cacheDirectory = options.cacheDirectory;
      delete options.cacheDirectory;
    }
    if (Array.isArray(options.cacheableOperations)) {
      buildscaleJson.targetDefaults ??= {};
      for (const target of options.cacheableOperations) {
        buildscaleJson.targetDefaults[target] ??= {};
        buildscaleJson.targetDefaults[target].cache ??= true;
      }
      delete options.cacheableOperations;
    }
    if (
      ['buildscale-cloud', '@nrwl/buildscale-cloud', 'buildscale/tasks-runners/default'].includes(
        runner
      )
    ) {
      delete buildscaleJson.tasksRunnerOptions.default.runner;
      if (Object.values(options).length === 0) {
        delete buildscaleJson.tasksRunnerOptions;
      }
    }
    return buildscaleJson;
  });

  await formatChangedFilesWithPrettierIfAvailable(tree);
}

async function isBuildscaleCloudClientSupported(buildscaleJson: BuildscaleJsonConfiguration) {
  const buildscaleCloudOptions = getRunnerOptions('default', buildscaleJson, {}, true);

  // Non enterprise workspaces support the Buildscale Cloud Client
  if (!isBuildscaleCloudEnterpriseWorkspace(buildscaleJson)) {
    return true;
  }

  // If we can get the buildscale cloud client, it's supported
  try {
    await verifyOrUpdateBuildscaleCloudClient(buildscaleCloudOptions);
    return true;
  } catch (e) {
    if (e instanceof BuildscaleCloudEnterpriseOutdatedError) {
      output.warn({
        title: 'Buildscale Cloud Instance is outdated.',
        bodyLines: [
          'If you are an BuildScale Enterprise customer, please reach out to your assigned Developer Productivity Engineer.',
          'If you are NOT an BuildScale Enterprise customer but are seeing this message, please reach out to cloud-support@nrwl.io.',
        ],
      });
    }
    return false;
  }
}

function isBuildscaleCloudEnterpriseWorkspace(buildscaleJson: BuildscaleJsonConfiguration) {
  const { runner, options } = buildscaleJson.tasksRunnerOptions.default;
  return (
    (runner === 'buildscale-cloud' || runner === '@nrwl/buildscale-cloud') &&
    options.url &&
    ![
      'https://buildscale.app',
      'https://cloud.buildscalew.app',
      'https://staging.buildscalew.app',
      'https://snapshot.buildscalew.app',
    ].includes(options.url)
  );
}

function removeBuildscaleCloudDependency(tree: Tree) {
  if (tree.exists('package.json')) {
    updateJson<PackageJson>(tree, 'package.json', (packageJson) => {
      delete packageJson.dependencies?.['buildscale-cloud'];
      delete packageJson.devDependencies?.['buildscale-cloud'];
      delete packageJson.dependencies?.['@nrwl/buildscale-cloud'];
      delete packageJson.devDependencies?.['@nrwl/buildscale-cloud'];
      return packageJson;
    });
  }
}
