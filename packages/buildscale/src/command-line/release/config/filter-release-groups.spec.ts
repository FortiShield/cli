import { type ProjectGraph } from '../../../devkit-exports';
import { IMPLICIT_DEFAULT_RELEASE_GROUP, BuildscaleReleaseConfig } from './config';
import { DEFAULT_CONVENTIONAL_COMMITS_CONFIG } from './conventional-commits';
import { filterReleaseGroups } from './filter-release-groups';

describe('filterReleaseGroups()', () => {
  let projectGraph: ProjectGraph;
  let buildscaleReleaseConfig: BuildscaleReleaseConfig;

  beforeEach(() => {
    buildscaleReleaseConfig = {
      projectsRelationship: 'fixed',
      groups: {},
      changelog: {
        git: {
          commit: true,
          commitMessage: '',
          commitArgs: '',
          tag: true,
          tagMessage: '',
          tagArgs: '',
          stageChanges: false,
        },
        workspaceChangelog: false,
        projectChangelogs: false,
        automaticFromRef: false,
      },
      version: {
        conventionalCommits: false,
        generator: '',
        generatorOptions: {},
        git: {
          stageChanges: true,
          commit: false,
          commitMessage: '',
          commitArgs: '',
          tag: false,
          tagMessage: '',
          tagArgs: '',
        },
        preVersionCommand: '',
      },
      releaseTagPattern: '',
      git: {
        commit: false,
        commitMessage: '',
        commitArgs: '',
        tag: false,
        tagMessage: '',
        tagArgs: '',
        stageChanges: false,
      },
      conventionalCommits: DEFAULT_CONVENTIONAL_COMMITS_CONFIG,
    };
    projectGraph = {
      nodes: {
        'lib-a': {
          name: 'lib-a',
          type: 'lib',
          data: {
            root: 'libs/lib-a',
            targets: {
              'buildscale-release-publish': {},
            },
          } as any,
        },
        'lib-b': {
          name: 'lib-b',
          type: 'lib',
          data: {
            root: 'libs/lib-b',
            targets: {
              'buildscale-release-publish': {},
            },
          } as any,
        },
      },
      dependencies: {},
    };
  });

  describe('projects filter', () => {
    it('should return an error if the user provided projects filter does not match any projects in the workspace', () => {
      const { error } = filterReleaseGroups(projectGraph, buildscaleReleaseConfig, [
        'missing',
      ]);
      expect(error).toMatchInlineSnapshot(`
        {
          "title": "Your --projects filter "missing" did not match any projects in the workspace",
        }
      `);
    });

    it('should return an error if projects match the filter but do not belong to any release groups', () => {
      buildscaleReleaseConfig.groups = {
        foo: {
          projectsRelationship: 'fixed',
          projects: ['lib-a'],
          changelog: false,
          version: {
            conventionalCommits: false,
            generator: '',
            generatorOptions: {},
          },
          releaseTagPattern: '',
        },
      };
      const { error } = filterReleaseGroups(projectGraph, buildscaleReleaseConfig, [
        'lib-b',
      ]);
      expect(error).toMatchInlineSnapshot(`
        {
          "bodyLines": [
            "- lib-b",
          ],
          "title": "The following projects which match your projects filter "lib-b" did not match any configured release groups:",
        }
      `);
    });

    it('should match all release groups and projects within them if the projects filter is empty', () => {
      buildscaleReleaseConfig.groups = {
        foo: {
          projectsRelationship: 'fixed',
          projects: ['lib-a'],
          changelog: false,
          version: {
            conventionalCommits: false,
            generator: '',
            generatorOptions: {},
          },
          releaseTagPattern: '',
        },
        bar: {
          projectsRelationship: 'fixed',
          projects: ['lib-b'],
          changelog: false,
          version: {
            conventionalCommits: false,
            generator: '',
            generatorOptions: {},
          },
          releaseTagPattern: '',
        },
      };
      const { error, releaseGroups, releaseGroupToFilteredProjects } =
        filterReleaseGroups(projectGraph, buildscaleReleaseConfig, []);
      expect(error).toBeNull();
      expect(releaseGroups).toMatchInlineSnapshot(`
        [
          {
            "changelog": false,
            "name": "foo",
            "projects": [
              "lib-a",
            ],
            "projectsRelationship": "fixed",
            "releaseTagPattern": "",
            "version": {
              "conventionalCommits": false,
              "generator": "",
              "generatorOptions": {},
            },
          },
          {
            "changelog": false,
            "name": "bar",
            "projects": [
              "lib-b",
            ],
            "projectsRelationship": "fixed",
            "releaseTagPattern": "",
            "version": {
              "conventionalCommits": false,
              "generator": "",
              "generatorOptions": {},
            },
          },
        ]
      `);
      expect(releaseGroupToFilteredProjects).toMatchInlineSnapshot(`
        Map {
          {
            "changelog": false,
            "name": "foo",
            "projects": [
              "lib-a",
            ],
            "projectsRelationship": "fixed",
            "releaseTagPattern": "",
            "version": {
              "conventionalCommits": false,
              "generator": "",
              "generatorOptions": {},
            },
          } => Set {
            "lib-a",
          },
          {
            "changelog": false,
            "name": "bar",
            "projects": [
              "lib-b",
            ],
            "projectsRelationship": "fixed",
            "releaseTagPattern": "",
            "version": {
              "conventionalCommits": false,
              "generator": "",
              "generatorOptions": {},
            },
          } => Set {
            "lib-b",
          },
        }
      `);
    });

    it('should produce an appropriately formatted error for the IMPLICIT_DEFAULT_RELEASE_GROUP', () => {
      buildscaleReleaseConfig.groups = {
        [IMPLICIT_DEFAULT_RELEASE_GROUP]: {
          projectsRelationship: 'fixed',
          projects: ['lib-a', 'lib-a'],
          changelog: false,
          version: {
            conventionalCommits: false,
            generator: '',
            generatorOptions: {},
          },
          releaseTagPattern: '',
        },
      };
      const { error } = filterReleaseGroups(projectGraph, buildscaleReleaseConfig, [
        'lib-a',
        'lib-a',
      ]);
      expect(error).toMatchInlineSnapshot(`
        {
          "bodyLines": [],
          "title": "In order to release specific projects independently with --projects those projects must be configured appropriately. For example, by setting \`"projectsRelationship": "independent"\` in your buildscale.json config.",
        }
      `);
    });

    it('should return an error if projects match the filter but they are in custom release groups which are not independent', () => {
      buildscaleReleaseConfig.groups = {
        foo: {
          projectsRelationship: 'fixed', // these projects are not independent, so are not targetable by the projects filter
          projects: ['lib-a'],
          changelog: false,
          version: {
            conventionalCommits: false,
            generator: '',
            generatorOptions: {},
          },
          releaseTagPattern: '',
        },
        bar: {
          projectsRelationship: 'independent',
          projects: ['lib-b'],
          changelog: false,
          version: {
            conventionalCommits: false,
            generator: '',
            generatorOptions: {},
          },
          releaseTagPattern: '',
        },
      };
      const { error } = filterReleaseGroups(projectGraph, buildscaleReleaseConfig, [
        'lib-a',
      ]);
      expect(error).toMatchInlineSnapshot(`
        {
          "bodyLines": [
            "- foo",
          ],
          "title": "Your --projects filter "lib-a" matched projects in the following release groups which do not have "independent" configured for their "projectsRelationship":",
        }
      `);
    });

    it('should filter the release groups and projects appropriately', () => {
      buildscaleReleaseConfig.groups = {
        foo: {
          projectsRelationship: 'independent',
          projects: ['lib-a'],
          changelog: false,
          version: {
            conventionalCommits: false,
            generator: '',
            generatorOptions: {},
          },
          releaseTagPattern: '',
        },
        bar: {
          projectsRelationship: 'fixed',
          projects: ['lib-b'],
          changelog: false,
          version: {
            conventionalCommits: false,
            generator: '',
            generatorOptions: {},
          },
          releaseTagPattern: '',
        },
      };
      const { error, releaseGroups, releaseGroupToFilteredProjects } =
        filterReleaseGroups(projectGraph, buildscaleReleaseConfig, ['lib-a']);
      expect(error).toBeNull();
      expect(releaseGroups).toMatchInlineSnapshot(`
        [
          {
            "changelog": false,
            "name": "foo",
            "projects": [
              "lib-a",
            ],
            "projectsRelationship": "independent",
            "releaseTagPattern": "",
            "version": {
              "conventionalCommits": false,
              "generator": "",
              "generatorOptions": {},
            },
          },
        ]
      `);
      expect(releaseGroupToFilteredProjects).toMatchInlineSnapshot(`
        Map {
          {
            "changelog": false,
            "name": "foo",
            "projects": [
              "lib-a",
            ],
            "projectsRelationship": "independent",
            "releaseTagPattern": "",
            "version": {
              "conventionalCommits": false,
              "generator": "",
              "generatorOptions": {},
            },
          } => Set {
            "lib-a",
          },
        }
      `);
    });
  });

  describe('release groups filter', () => {
    it('should return an error if the user provided release groups filter does not match any release groups in the workspace', () => {
      const { error } = filterReleaseGroups(
        projectGraph,
        buildscaleReleaseConfig,
        [],
        ['not-a-group-name']
      );
      expect(error).toMatchInlineSnapshot(`
        {
          "title": "Your --groups filter "not-a-group-name" did not match any release groups in the workspace",
        }
      `);
    });

    it('should filter based on the given release group name', () => {
      buildscaleReleaseConfig.groups = {
        foo: {
          projectsRelationship: 'fixed',
          projects: ['lib-a'],
          changelog: false,
          version: {
            conventionalCommits: false,
            generator: '',
            generatorOptions: {},
          },
          releaseTagPattern: '',
        },
        bar: {
          projectsRelationship: 'fixed',
          projects: ['lib-b'],
          changelog: false,
          version: {
            conventionalCommits: false,
            generator: '',
            generatorOptions: {},
          },
          releaseTagPattern: '',
        },
      };
      const { error, releaseGroups, releaseGroupToFilteredProjects } =
        filterReleaseGroups(projectGraph, buildscaleReleaseConfig, [], ['foo']);
      expect(error).toBeNull();
      expect(releaseGroups).toMatchInlineSnapshot(`
        [
          {
            "changelog": false,
            "name": "foo",
            "projects": [
              "lib-a",
            ],
            "projectsRelationship": "fixed",
            "releaseTagPattern": "",
            "version": {
              "conventionalCommits": false,
              "generator": "",
              "generatorOptions": {},
            },
          },
        ]
      `);
      expect(releaseGroupToFilteredProjects).toMatchInlineSnapshot(`
        Map {
          {
            "changelog": false,
            "name": "foo",
            "projects": [
              "lib-a",
            ],
            "projectsRelationship": "fixed",
            "releaseTagPattern": "",
            "version": {
              "conventionalCommits": false,
              "generator": "",
              "generatorOptions": {},
            },
          } => Set {
            "lib-a",
          },
        }
      `);
    });
  });
});
