import type { Change, FileChange } from '../file-utils';
import { BuildscaleJsonConfiguration } from '../../config/buildscale-json';
import {
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../../config/project-graph';

export interface AffectedProjectGraphContext {
  projectGraphNodes: Record<string, ProjectGraphProjectNode>;
  buildscaleJson: BuildscaleJsonConfiguration<any>;
  touchedProjects: string[];
}

export interface TouchedProjectLocator<T extends Change = Change> {
  (
    fileChanges: FileChange<T>[],
    projectGraphNodes?: Record<string, ProjectGraphProjectNode>,
    buildscaleJson?: BuildscaleJsonConfiguration<any>,
    packageJson?: any,
    projectGraph?: ProjectGraph
  ): string[] | Promise<string[]>;
}
