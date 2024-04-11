import type { BuildscaleJsonConfiguration } from './buildscale-json';
import {
  ProjectConfiguration,
  ProjectsConfigurations,
} from './workspace-json-project-json';
import {
  findProjectForPath,
  normalizeProjectRoot,
} from '../project-graph/utils/find-project-for-path';
import { relative } from 'path';

export function calculateDefaultProjectName(
  cwd: string,
  root: string,
  { projects }: ProjectsConfigurations,
  buildscaleJson: BuildscaleJsonConfiguration
) {
  const relativeCwd = relative(root, cwd).replace(/\\/g, '/') ?? null;
  if (relativeCwd !== null) {
    const matchingProject = findMatchingProjectInCwd(projects, relativeCwd);
    // We have found a project
    if (matchingProject) {
      // That is not at the root
      if (
        projects[matchingProject].root !== '.' &&
        projects[matchingProject].root !== ''
      ) {
        return matchingProject;
        // But its at the root, and BUILDSCALE_DEFAULT_PROJECT is set
      } else if (process.env.BUILDSCALE_DEFAULT_PROJECT) {
        return process.env.BUILDSCALE_DEFAULT_PROJECT;
        // Its root, and BUILDSCALE_DEFAULT_PROJECT is not set
      } else {
        return matchingProject;
      }
    }
  }
  // There was no matching project in cwd.
  return (
    process.env.BUILDSCALE_DEFAULT_PROJECT ??
    (buildscaleJson.cli as { defaultProjectName: string })?.defaultProjectName ??
    buildscaleJson?.defaultProject
  );
}

export function findMatchingProjectInCwd(
  projects: Record<string, ProjectConfiguration>,
  relativeCwd: string
): string | undefined {
  const projectRootMappings = new Map<string, string>();
  for (const projectName of Object.keys(projects)) {
    const { root } = projects[projectName];
    projectRootMappings.set(normalizeProjectRoot(root), projectName);
  }
  const matchingProject = findProjectForPath(relativeCwd, projectRootMappings);
  return matchingProject;
}
