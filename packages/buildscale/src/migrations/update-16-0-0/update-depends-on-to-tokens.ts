import {
  getProjects,
  readBuildscaleJson,
  updateBuildscaleJson,
  updateProjectConfiguration,
} from '../../generators/utils/project-configuration';
import { Tree } from '../../generators/tree';
import { formatChangedFilesWithPrettierIfAvailable } from '../../generators/internal-utils/format-changed-files-with-prettier-if-available';

export default async function (tree: Tree) {
  updateDependsOnAndInputsInsideBuildscaleJson(tree);

  const projectsConfigurations = getProjects(tree);
  for (const [projectName, projectConfiguration] of projectsConfigurations) {
    let projectChanged = false;
    for (const [targetName, targetConfiguration] of Object.entries(
      projectConfiguration.targets ?? {}
    )) {
      for (const dependency of targetConfiguration.dependsOn ?? []) {
        if (typeof dependency !== 'string') {
          if (
            dependency.projects === 'self' ||
            dependency.projects === '{self}'
          ) {
            delete dependency.projects;
            projectChanged = true;
          } else if (
            dependency.projects === 'dependencies' ||
            dependency.projects === '{dependencies}'
          ) {
            delete dependency.projects;
            dependency.dependencies = true;
            projectChanged = true;
          }
        }
      }
      for (let i = 0; i < targetConfiguration.inputs?.length ?? 0; i++) {
        const input = targetConfiguration.inputs[i];
        if (typeof input !== 'string') {
          if (
            'projects' in input &&
            (input.projects === 'self' || input.projects === '{self}')
          ) {
            delete input.projects;
            projectChanged = true;
          } else if (
            'projects' in input &&
            (input.projects === 'dependencies' ||
              input.projects === '{dependencies}')
          ) {
            delete input.projects;
            targetConfiguration.inputs[i] = {
              ...input,
              dependencies: true,
            };
            projectChanged = true;
          }
        }
      }
    }
    if (projectChanged) {
      updateProjectConfiguration(tree, projectName, projectConfiguration);
    }
  }

  await formatChangedFilesWithPrettierIfAvailable(tree);
}
function updateDependsOnAndInputsInsideBuildscaleJson(tree: Tree) {
  const buildscaleJson = readBuildscaleJson(tree);
  let buildscaleJsonChanged = false;
  for (const [target, defaults] of Object.entries(
    buildscaleJson?.targetDefaults ?? {}
  )) {
    for (const dependency of defaults.dependsOn ?? []) {
      if (typeof dependency !== 'string') {
        if (
          dependency.projects === 'self' ||
          dependency.projects === '{self}'
        ) {
          delete dependency.projects;
          buildscaleJsonChanged = true;
        } else if (
          dependency.projects === 'dependencies' ||
          dependency.projects === '{dependencies}'
        ) {
          delete dependency.projects;
          dependency.dependencies = true;
          buildscaleJsonChanged = true;
        }
      }
    }
    for (let i = 0; i < defaults.inputs?.length ?? 0; i++) {
      const input = defaults.inputs[i];
      if (typeof input !== 'string') {
        if (
          'projects' in input &&
          (input.projects === 'self' || input.projects === '{self}')
        ) {
          delete input.projects;
          buildscaleJsonChanged = true;
        } else if (
          'projects' in input &&
          (input.projects === 'dependencies' ||
            input.projects === '{dependencies}')
        ) {
          delete input.projects;
          defaults.inputs[i] = {
            ...input,
            dependencies: true,
          };
          buildscaleJsonChanged = true;
        }
      }
    }
  }
  if (buildscaleJsonChanged) {
    updateBuildscaleJson(tree, buildscaleJson);
  }
}
