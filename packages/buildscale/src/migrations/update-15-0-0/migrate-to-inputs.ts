import { Tree } from '../../generators/tree';
import { formatChangedFilesWithPrettierIfAvailable } from '../../generators/internal-utils/format-changed-files-with-prettier-if-available';
import {
  getProjects,
  updateProjectConfiguration,
} from '../../generators/utils/project-configuration';
import { readBuildscaleJson, updateBuildscaleJson } from '../../generators/utils/buildscale-json';
import { joinPathFragments } from '../../utils/path';
import { join } from 'path';
import { updateJson } from '../../generators/utils/json';
import { PackageJson } from '../../utils/package-json';

const skippedFiles = [
  'package.json', // Not to be added to filesets
  'babel.config.json', // Will be handled by various plugins
  'karma.conf.js', // Will be handled by @buildscale/angular
  'jest.preset.js', // Will be handled by @buildscale/jest
  '.storybook', // Will be handled by @buildscale/storybook
  // Will be handled by @buildscale/eslint
  '.eslintrc.json',
  '.eslintrc.js',
];

export default async function (tree: Tree) {
  // If the workspace doesn't have a buildscale.json, don't make any changes
  if (!tree.exists('buildscale.json')) {
    return;
  }

  const buildscaleJson = readBuildscaleJson(tree);

  // If this is a npm workspace, don't make any changes
  if (buildscaleJson.extends === 'buildscale/presets/npm.json') {
    return;
  }

  buildscaleJson.namedInputs ??= {
    default: ['{projectRoot}/**/*', 'sharedGlobals'],
    sharedGlobals: [],
    production: ['default'],
  };
  if (buildscaleJson.namedInputs.default) {
    if (!buildscaleJson.namedInputs.production) {
      buildscaleJson.namedInputs.production = ['default'];
    } else if (!buildscaleJson.namedInputs.production.includes('default')) {
      buildscaleJson.namedInputs.production = [
        'default',
        ...buildscaleJson.namedInputs.production,
      ];
    }
  }

  if (isBuildATarget(tree)) {
    buildscaleJson.targetDefaults ??= {};
    buildscaleJson.targetDefaults.build ??= {};
    buildscaleJson.targetDefaults.build.inputs ??= ['production', '^production'];
  }

  if (buildscaleJson.implicitDependencies) {
    const projects = getProjects(tree);

    for (const [files, dependents] of Object.entries(
      buildscaleJson.implicitDependencies
    )) {
      // Skip these because other plugins take care of them
      if (skippedFiles.includes(files)) {
        continue;
      } else if (Array.isArray(dependents)) {
        buildscaleJson.namedInputs.projectSpecificFiles = [];
        const defaultFileset = new Set(
          buildscaleJson.namedInputs.default ?? ['{projectRoot}/**/*', 'sharedGlobals']
        );
        defaultFileset.add('projectSpecificFiles');
        buildscaleJson.namedInputs.default = Array.from(defaultFileset);

        for (const dependent of dependents) {
          const project = projects.get(dependent);
          project.namedInputs ??= {};
          const projectSpecificFileset = new Set(
            project.namedInputs.projectSpecificFiles ?? []
          );
          projectSpecificFileset.add(
            joinPathFragments('{workspaceRoot}', files)
          );
          project.namedInputs.projectSpecificFiles = Array.from(
            projectSpecificFileset
          );

          try {
            updateProjectConfiguration(tree, dependent, project);
          } catch {
            if (tree.exists(join(project.root, 'package.json'))) {
              updateJson<PackageJson>(
                tree,
                join(project.root, 'package.json'),
                (json) => {
                  json.buildscale ??= {};
                  json.buildscale.namedInputs ??= {};
                  json.buildscale.namedInputs.projectSpecificFiles ??=
                    project.namedInputs.projectSpecificFiles;

                  return json;
                }
              );
            }
          }
        }
      } else {
        buildscaleJson.namedInputs.sharedGlobals.push(
          joinPathFragments('{workspaceRoot}', files)
        );
      }
    }
    delete buildscaleJson.implicitDependencies;
  }

  updateBuildscaleJson(tree, buildscaleJson);

  await formatChangedFilesWithPrettierIfAvailable(tree);
}

function isBuildATarget(tree: Tree) {
  const projects = getProjects(tree);

  for (const [_, project] of projects) {
    if (project.targets?.build) {
      return true;
    }
  }

  return false;
}
