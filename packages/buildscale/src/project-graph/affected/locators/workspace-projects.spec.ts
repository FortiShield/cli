import {
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../../../config/project-graph';
import { ProjectConfiguration } from '../../../config/workspace-json-project-json';
import { WholeFileChange } from '../../file-utils';
import {
  getTouchedProjects,
  getImplicitlyTouchedProjects,
} from './workspace-projects';

function getFileChanges(files: string[]) {
  return files.map((f) => ({
    file: f,
    hash: 'some-hash',
    getChanges: () => [new WholeFileChange()],
  }));
}

describe('getTouchedProjects', () => {
  it('should return a list of projects for the given changes', () => {
    const fileChanges = getFileChanges(['libs/a/index.ts', 'libs/b/index.ts']);
    const projects = {
      a: { root: 'libs/a' },
      b: { root: 'libs/b' },
      c: { root: 'libs/c' },
    };
    expect(
      getTouchedProjects(fileChanges, buildProjectGraphNodes(projects))
    ).toEqual(['a', 'b']);
  });

  it('should return projects with the root matching a whole directory name in the file path', () => {
    const fileChanges = getFileChanges(['libs/a-b/index.ts']);
    const projects = {
      a: { root: 'libs/a' },
      abc: { root: 'libs/a-b-c' },
      ab: { root: 'libs/a-b' },
    };
    expect(
      getTouchedProjects(fileChanges, buildProjectGraphNodes(projects))
    ).toEqual(['ab']);
  });

  it('should return projects with the root matching a whole directory name in the file path', () => {
    const fileChanges = getFileChanges(['libs/a-b/index.ts']);
    const projects = {
      aaaaa: { root: 'libs/a' },
      abc: { root: 'libs/a-b-c' },
      ab: { root: 'libs/a-b' },
    };
    expect(
      getTouchedProjects(fileChanges, buildProjectGraphNodes(projects))
    ).toEqual(['ab']);
  });

  it('should return the most qualifying match with the file path', () => {
    const fileChanges = getFileChanges(['libs/a/b/index.ts']);
    const projects = {
      aaaaa: { root: 'libs/a' },
      ab: { root: 'libs/a/b' },
    };
    expect(
      getTouchedProjects(fileChanges, buildProjectGraphNodes(projects))
    ).toEqual(['ab']);
  });

  it('should not return parent project if nested project is touched', () => {
    const fileChanges = getFileChanges(['libs/a/b/index.ts']);
    const projects = {
      a: { root: 'libs/a' },
      b: { root: 'libs/a/b' },
    };
    expect(
      getTouchedProjects(fileChanges, buildProjectGraphNodes(projects))
    ).toEqual(['b']);
  });
});

describe('getImplicitlyTouchedProjects', () => {
  let buildscaleJson;

  beforeEach(() => {
    buildscaleJson = {
      npmScope: 'nrwl',
      namedInputs: {
        files: ['{workspaceRoot}/a.txt'],
      },
      projects: {},
    };
  });

  it('should return projects which have touched files in their named inputs', () => {
    const graph = buildProjectGraphNodes({
      a: {
        root: 'a',
        namedInputs: {
          projectSpecificFiles: ['{workspaceRoot}/a.txt'],
        },
        targets: {
          build: {
            inputs: ['projectSpecificFiles'],
          },
        },
      },
      b: {
        root: 'b',
      },
    });
    let fileChanges = getFileChanges(['a.txt']);
    expect(getImplicitlyTouchedProjects(fileChanges, graph, buildscaleJson)).toEqual([
      'a',
    ]);
  });

  it('should return projects which have touched files in their target inputs', () => {
    const graph = buildProjectGraphNodes({
      a: {
        root: 'a',
        targets: {
          build: {
            inputs: ['{workspaceRoot}/a.txt'],
          },
        },
      },
      b: {
        root: 'b',
      },
    });
    let fileChanges = getFileChanges(['a.txt']);
    expect(getImplicitlyTouchedProjects(fileChanges, graph, buildscaleJson)).toEqual([
      'a',
    ]);
  });

  it('should return projects which have touched files in their target inputs which are named inputs defined in buildscale.json', () => {
    const graph = buildProjectGraphNodes({
      a: {
        root: 'a',
        targets: {
          build: {
            inputs: ['files'],
          },
        },
      },
      b: {
        root: 'b',
      },
    });
    let fileChanges = getFileChanges(['a.txt']);
    expect(getImplicitlyTouchedProjects(fileChanges, graph, buildscaleJson)).toEqual([
      'a',
    ]);
  });

  it('should not return projects which have touched files inputs which are not used by its targets', () => {
    const graph = buildProjectGraphNodes({
      a: {
        root: 'a',
        namedInputs: {
          files: ['{workspaceRoot}/a.txt'],
        },
        targets: {},
      },
      b: {
        root: 'b',
      },
    });
    let fileChanges = getFileChanges(['a.txt']);
    expect(getImplicitlyTouchedProjects(fileChanges, graph, buildscaleJson)).toEqual(
      []
    );
  });
});

function buildProjectGraphNodes(
  projects: Record<string, ProjectConfiguration>
): ProjectGraph['nodes'] {
  return Object.fromEntries(
    Object.entries(projects).map(
      ([name, config]): [string, ProjectGraphProjectNode] => [
        name,
        {
          data: config as any,
          name,
          type: config.projectType === 'application' ? 'app' : 'lib',
        },
      ]
    )
  );
}
