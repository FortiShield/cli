import { dirname } from 'path';
import {
  readCachedProjectGraph,
  readProjectsConfigurationFromProjectGraph,
} from '../project-graph/project-graph';

import type { BuildscaleJsonConfiguration } from './buildscale-json';
import { readBuildscaleJson } from './buildscale-json';
import { ProjectsConfigurations } from './workspace-json-project-json';

// TODO(v19): remove this class
/**
 * @deprecated This will be removed in v19. Use {@link readProjectsConfigurationFromProjectGraph} instead.
 */
export class Workspaces {
  constructor(private root: string) {}

  /**
   * @deprecated Use {@link readProjectsConfigurationFromProjectGraph} instead.
   */
  readWorkspaceConfiguration(): ProjectsConfigurations & BuildscaleJsonConfiguration {
    const buildscaleJson = readBuildscaleJson(this.root);

    return {
      ...readProjectsConfigurationFromProjectGraph(readCachedProjectGraph()),
      ...buildscaleJson,
    };
  }
}

/**
 * Pulled from toFileName in names from @buildscale/devkit.
 * Todo: Should refactor, not duplicate.
 */
export function toProjectName(fileName: string): string {
  const parts = dirname(fileName).split(/[\/\\]/g);
  return parts[parts.length - 1].toLowerCase();
}
