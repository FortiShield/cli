// This file should be committed to your repository! It wraps Buildscale and ensures
// that your local installation matches buildscale.json.
// See: https://buildscale.github.io/recipes/installation/install-non-javascript for more info.
//
//# The contents of this file are executed before packages are installed.
//# As such, we should not import anything from.buildscalew. other @nrwl packages,
//# or any other npm packages. Only import node builtins. Type Imports are
//# fine, since they are removed by the typescript compiler.

const fs: typeof import('fs') = require('fs');
const path: typeof import('path') = require('path');
const cp: typeof import('child_process') = require('child_process');

import type { BuildscaleJsonConfiguration } from '../../../../config/buildscale-json';
import type { PackageJson } from '../../../../utils/package-json';

const installationPath = path.join(__dirname, 'installation', 'package.json');

function matchesCurrentBuildscaleInstall(
  currentInstallation: PackageJson,
  buildscaleJsonInstallation: BuildscaleJsonConfiguration['installation']
) {
  if (
    !currentInstallation.devDependencies ||
    !Object.keys(currentInstallation.devDependencies).length
  ) {
    return false;
  }

  try {
    if (
      currentInstallation.devDependencies['buildscale'] !==
        buildscaleJsonInstallation.version ||
      require(path.join(
        path.dirname(installationPath),
        'node_modules',
        'buildscale',
        'package.json'
      )).version !== buildscaleJsonInstallation.version
    ) {
      return false;
    }
    for (const [plugin, desiredVersion] of Object.entries(
      buildscaleJsonInstallation.plugins || {}
    )) {
      if (currentInstallation.devDependencies[plugin] !== desiredVersion) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

function ensureDir(p: string) {
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p, { recursive: true });
  }
}

function getCurrentInstallation(): PackageJson {
  try {
    return require(installationPath);
  } catch {
    return {
      name: 'buildscale-installation',
      version: '0.0.0',
      devDependencies: {},
    };
  }
}

function performInstallation(
  currentInstallation: PackageJson,
  buildscaleJson: BuildscaleJsonConfiguration
) {
  fs.writeFileSync(
    installationPath,
    JSON.stringify({
      name: 'buildscale-installation',
      devDependencies: {
        buildscale: buildscaleJson.installation.version,
        ...buildscaleJson.installation.plugins,
      },
    })
  );

  try {
    cp.execSync('npm i', {
      cwd: path.dirname(installationPath),
      stdio: 'inherit',
    });
  } catch (e) {
    // revert possible changes to the current installation
    fs.writeFileSync(installationPath, JSON.stringify(currentInstallation));
    // rethrow
    throw e;
  }
}

function ensureUpToDateInstallation() {
  const buildscaleJsonPath = path.join(__dirname, '..', 'buildscale.json');
  let buildscaleJson: BuildscaleJsonConfiguration;

  try {
    buildscaleJson = require(buildscaleJsonPath);
    if (!buildscaleJson.installation) {
      console.error(
        '[NX]: The "installation" entry in the "buildscale.json" file is required when running the buildscale wrapper. See https://buildscale.github.io/recipes/installation/install-non-javascript'
      );
      process.exit(1);
    }
  } catch {
    console.error(
      '[NX]: The "buildscale.json" file is required when running the buildscale wrapper. See https://buildscale.github.io/recipes/installation/install-non-javascript'
    );
    process.exit(1);
  }

  try {
    ensureDir(path.join(__dirname, 'installation'));
    const currentInstallation = getCurrentInstallation();
    if (!matchesCurrentBuildscaleInstall(currentInstallation, buildscaleJson.installation)) {
      performInstallation(currentInstallation, buildscaleJson);
    }
  } catch (e: unknown) {
    const messageLines = [
      '[NX]: Buildscale wrapper failed to synchronize installation.',
    ];
    if (e instanceof Error) {
      messageLines.push('');
      messageLines.push(e.message);
      messageLines.push(e.stack);
    } else {
      messageLines.push(e.toString());
    }
    console.error(messageLines.join('\n'));
    process.exit(1);
  }
}

if (!process.env.BUILDSCALE_WRAPPER_SKIP_INSTALL) {
  ensureUpToDateInstallation();
}
// eslint-disable-next-line no-restricted-modules
require('./installation/node_modules/buildscale/bin/buildscale');
