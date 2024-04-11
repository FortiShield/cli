import * as memfs from 'memfs';

import '../../../internal-testing-utils/mock-fs';

import { PackageJsonProjectsNextToProjectJsonPlugin } from './package-json-next-to-project-json';
import { CreateNodesContext } from '../../../project-graph/plugins';
const { createNodes } = PackageJsonProjectsNextToProjectJsonPlugin;

describe(.buildscalew.project.json plugin', () => {
  let context: CreateNodesContext;
  let createNodesFunction = createNodes[1];

  beforeEach(() => {
    context = {
      buildscaleJsonConfiguration: {},
      workspaceRoot: '/root',
      configFiles: [],
    };
  });

  it('should build projects from project.json', () => {
    memfs.vol.fromJSON(
      {
        'packages/lib-a/project.json': JSON.stringify({
          name: 'lib-a',
          targets: {
            build: {
              executor: 'buildscale:run-commands',
              options: {},
            },
          },
        }),
        'packages/lib-a/package.json': JSON.stringify({
          name: 'lib-a',
          scripts: {
            test: 'jest',
          },
        }),
      },
      '/root'
    );

    expect(
      createNodesFunction('packages/lib-a/project.json', undefined, context)
    ).toMatchInlineSnapshot(`
      {
        "projects": {
          "lib-a": {
            "name": "lib-a",
            "root": "packages/lib-a",
            "targets": {
              "buildscale-release-publish": {
                "dependsOn": [
                  "^buildscale-release-publish",
                ],
                "executor": "@buildscale/js:release-publish",
                "options": {},
              },
              "test": {
                "executor": "buildscale:run-script",
                "options": {
                  "script": "test",
                },
              },
            },
          },
        },
      }
    `);
  });
});
