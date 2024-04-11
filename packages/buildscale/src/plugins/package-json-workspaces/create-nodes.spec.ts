import * as memfs from 'memfs';

import '../../internal-testing-utils/mock-fs';
import { createNodeFromPackageJson } from './create-nodes';

describe(.buildscalew.package.json workspaces plugin', () => {
  it('should build projects from package.json files', () => {
    memfs.vol.fromJSON(
      {
        'package.json': JSON.stringify({
          name: 'root',
          scripts: { echo: 'echo root project' },
        }),
        'packages/lib-a/package.json': JSON.stringify({
          name: 'lib-a',
          scripts: { test: 'jest' },
        }),
        'packages/lib-b/package.json': JSON.stringify({
          name: 'lib-b',
          scripts: {
            build: 'tsc',
            test: 'jest',
            nonNxOperation: 'rm -rf .',
          },
          buildscale: {
            implicitDependencies: ['lib-a'],
            includedScripts: ['build', 'test'],
            targets: {
              build: {
                outputs: ['{projectRoot}/dist'],
              },
            },
          },
        }),
      },
      '/root'
    );

    expect(createNodeFromPackageJson('package.json', '/root'))
      .toMatchInlineSnapshot(`
      {
        "projects": {
          ".": {
            "name": "root",
            "projectType": "library",
            "root": ".",
            "sourceRoot": ".",
            "targets": {
              "echo": {
                "executor": "buildscale:run-script",
                "options": {
                  "script": "echo",
                },
              },
              "buildscale-release-publish": {
                "dependsOn": [
                  "^buildscale-release-publish",
                ],
                "executor": "@buildscale/js:release-publish",
                "options": {},
              },
            },
          },
        },
      }
    `);
    expect(createNodeFromPackageJson('packages/lib-a/package.json', '/root'))
      .toMatchInlineSnapshot(`
      {
        "projects": {
          "packages/lib-a": {
            "name": "lib-a",
            "projectType": "library",
            "root": "packages/lib-a",
            "sourceRoot": "packages/lib-a",
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
    expect(createNodeFromPackageJson('packages/lib-b/package.json', '/root'))
      .toMatchInlineSnapshot(`
      {
        "projects": {
          "packages/lib-b": {
            "implicitDependencies": [
              "lib-a",
            ],
            "includedScripts": [
              "build",
              "test",
            ],
            "name": "lib-b",
            "projectType": "library",
            "root": "packages/lib-b",
            "sourceRoot": "packages/lib-b",
            "targets": {
              "build": {
                "executor": "buildscale:run-script",
                "options": {
                  "script": "build",
                },
                "outputs": [
                  "{projectRoot}/dist",
                ],
              },
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
