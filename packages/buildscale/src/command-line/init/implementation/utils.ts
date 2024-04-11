import { execSync } from 'child_process';
import { join } from 'path';

import { BuildscaleJsonConfiguration } from '../../../config/buildscale-json';
import { runBuildscaleSync } from '../../../utils/child-process';
import {
  fileExists,
  readJsonFile,
  writeJsonFile,
} from '../../../utils/fileutils';
import { output } from '../../../utils/output';
import { PackageJson } from '../../../utils/package-json';
import {
  getPackageManagerCommand,
  PackageManagerCommands,
} from '../../../utils/package-manager';
import { joinPathFragments } from '../../../utils/path';
import { buildscaleVersion } from '../../../utils/versions';
import { existsSync, readFileSync, writeFileSync } from 'fs';

export function createBuildscaleJsonFile(
  repoRoot: string,
  topologicalTargets: string[],
  cacheableOperations: string[],
  scriptOutputs: { [name: string]: string }
) {
  const buildscaleJsonPath = joinPathFragments(repoRoot, 'buildscale.json');
  let buildscaleJson = {} as Partial<BuildscaleJsonConfiguration> & { $schema: string };
  try {
    buildscaleJson = readJsonFile(buildscaleJsonPath);
    // eslint-disable-next-line no-empty
  } catch {}

  buildscaleJson.$schema = './node_modules/buildscale/schemas/buildscale-schema.json';
  buildscaleJson.targetDefaults ??= {};

  if (topologicalTargets.length > 0) {
    for (const scriptName of topologicalTargets) {
      buildscaleJson.targetDefaults[scriptName] ??= {};
      buildscaleJson.targetDefaults[scriptName] = { dependsOn: [`^${scriptName}`] };
    }
  }
  for (const [scriptName, output] of Object.entries(scriptOutputs)) {
    if (!output) {
      // eslint-disable-next-line no-continue
      continue;
    }
    buildscaleJson.targetDefaults[scriptName] ??= {};
    buildscaleJson.targetDefaults[scriptName].outputs = [`{projectRoot}/${output}`];
  }

  for (const target of cacheableOperations) {
    buildscaleJson.targetDefaults[target] ??= {};
    buildscaleJson.targetDefaults[target].cache ??= true;
  }

  if (Object.keys(buildscaleJson.targetDefaults).length === 0) {
    delete buildscaleJson.targetDefaults;
  }

  buildscaleJson.defaultBase ??= deduceDefaultBase();
  writeJsonFile(buildscaleJsonPath, buildscaleJson);
}

function deduceDefaultBase() {
  try {
    execSync(`git rev-parse --verify main`, {
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    return 'main';
  } catch {
    try {
      execSync(`git rev-parse --verify dev`, {
        stdio: ['ignore', 'ignore', 'ignore'],
      });
      return 'dev';
    } catch {
      try {
        execSync(`git rev-parse --verify develop`, {
          stdio: ['ignore', 'ignore', 'ignore'],
        });
        return 'develop';
      } catch {
        try {
          execSync(`git rev-parse --verify next`, {
            stdio: ['ignore', 'ignore', 'ignore'],
          });
          return 'next';
        } catch {
          return 'master';
        }
      }
    }
  }
}

export function addDepsToPackageJson(
  repoRoot: string,
  additionalPackages?: string[]
) {
  const path = joinPathFragments(repoRoot, `package.json`);
  const json = readJsonFile(path);
  if (!json.devDependencies) json.devDependencies = {};
  json.devDependencies['buildscale'] = buildscaleVersion;
  if (additionalPackages) {
    for (const p of additionalPackages) {
      json.devDependencies[p] = buildscaleVersion;
    }
  }
  writeJsonFile(path, json);
}

export function updateGitIgnore(root: string) {
  const ignorePath = join(root, '.gitignore');
  try {
    let contents = readFileSync(ignorePath, 'utf-8');
    if (!contents.includes('.buildscale/cache')) {
      contents = [contents, '', '.buildscale/cache'].join('\n');
      writeFileSync(ignorePath, contents, 'utf-8');
    }
  } catch {}
}

export function runInstall(
  repoRoot: string,
  pmc: PackageManagerCommands = getPackageManagerCommand()
) {
  execSync(pmc.install, { stdio: [0, 1, 2], cwd: repoRoot });
}

export function initCloud(
  repoRoot: string,
  installationSource:
    | 'buildscale-init-angular'
    | 'buildscale-init-cra'
    | 'buildscale-init-monorepo'
    | 'buildscale-init-nest'
    | 'buildscale-init-npm-repo'
) {
  runBuildscaleSync(
    `g buildscale:connect-to-buildscale-cloud --installationSource=${installationSource} --quiet --no-interactive`,
    {
      stdio: [0, 1, 2],
      cwd: repoRoot,
    }
  );
}

export function addVsCodeRecommendedExtensions(
  repoRoot: string,
  extensions: string[]
): void {
  const vsCodeExtensionsPath = join(repoRoot, '.vscode/extensions.json');

  if (fileExists(vsCodeExtensionsPath)) {
    const vsCodeExtensionsJson = readJsonFile(vsCodeExtensionsPath);

    vsCodeExtensionsJson.recommendations ??= [];
    extensions.forEach((extension) => {
      if (!vsCodeExtensionsJson.recommendations.includes(extension)) {
        vsCodeExtensionsJson.recommendations.push(extension);
      }
    });

    writeJsonFile(vsCodeExtensionsPath, vsCodeExtensionsJson);
  } else {
    writeJsonFile(vsCodeExtensionsPath, { recommendations: extensions });
  }
}

export function markRootPackageJsonAsBuildscaleProjectLegacy(
  repoRoot: string,
  cacheableScripts: string[],
  pmc: PackageManagerCommands
) {
  const json = readJsonFile<PackageJson>(
    joinPathFragments(repoRoot, `package.json`)
  );
  json.buildscale = {};
  for (let script of cacheableScripts) {
    const scriptDefinition = json.scripts[script];
    if (!scriptDefinition) {
      continue;
    }

    if (scriptDefinition.includes('&&') || scriptDefinition.includes('||')) {
      let backingScriptName = `_${script}`;
      json.scripts[backingScriptName] = scriptDefinition;
      json.scripts[script] = `buildscale exec -- ${pmc.run(backingScriptName, '')}`;
    } else {
      json.scripts[script] = `buildscale exec -- ${json.scripts[script]}`;
    }
  }
  writeJsonFile(`package.json`, json);
}

export function markPackageJsonAsBuildscaleProject(
  packageJsonPath: string,
  cacheableScripts: string[]
) {
  const json = readJsonFile<PackageJson>(packageJsonPath);
  if (!json.scripts) {
    return;
  }

  json.buildscale = { includedScripts: [] };
  for (let script of cacheableScripts) {
    if (json.scripts[script]) {
      json.buildscale.includedScripts.push(script);
    }
  }
  writeJsonFile(packageJsonPath, json);
}

export function printFinalMessage({
  learnMoreLink,
  bodyLines,
}: {
  learnMoreLink?: string;
  bodyLines?: string[];
}): void {
  const normalizedBodyLines = (bodyLines ?? []).map((l) =>
    l.startsWith('- ') ? l : `- ${l}`
  );

  output.success({
    title: '🎉 Done!',
    bodyLines: [
      '- Enabled computation caching!',
      ...normalizedBodyLines,
      learnMoreLink ? `- Learn more at ${learnMoreLink}.` : undefined,
    ].filter(Boolean),
  });
}

export function isMonorepo(packageJson: PackageJson) {
  if (!!packageJson.workspaces) return true;

  if (existsSync('pnpm-workspace.yaml') || existsSync('pnpm-workspace.yml'))
    return true;

  if (existsSync('lerna.json')) return true;

  return false;
}
