import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import { Tree } from '../../generators/tree';
import { readJson, writeJson } from '../../generators/utils/json';
import buildscaleReleasePath from './buildscale-release-path';

describe('buildscaleReleasePath', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should update changelog renderer references', () => {
    writeJson(tree, 'buildscale.json', {
      $schema: './node_modules/buildscale/schemas/buildscale-schema.json',
      release: {
        changelog: {
          git: {
            commit: true,
            tag: true,
          },
          workspaceChangelog: {
            createRelease: 'github',
            renderer: 'buildscale/changelog-renderer',
          },
          projectChangelogs: {
            renderer: 'buildscale/changelog-renderer',
          },
        },
        version: {
          generatorOptions: {
            currentVersionResolver: 'git-tag',
            specifierSource: 'conventional-commits',
          },
        },
      },
    });

    tree.write(
      'some-script.js',
      `
      import { releaseVersion } from 'buildscale/src/command-line/release';
      const { releaseChangelog } = require("buildscale/src/command-line/release");
    `
    );

    // these should not be updated, only the formalized programmatic API
    tree.write(
      'some-other-file.ts',
      `
      import { foo } from 'buildscale/src/command-line/release/nested/thing';
      const { releaseChangelog } = require("buildscale/src/command-line/release/another/nested/thing");
    `
    );

    buildscaleReleasePath(tree);

    // intentionally unchanged
    expect(tree.read('some-other-file.ts').toString('utf-8'))
      .toMatchInlineSnapshot(`
      "
            import { foo } from 'buildscale/src/command-line/release/nested/thing';
            const { releaseChangelog } = require("buildscale/src/command-line/release/another/nested/thing");
          "
    `);

    // programmatic API should be updated to buildscale/release
    expect(tree.read('some-script.js').toString('utf-8'))
      .toMatchInlineSnapshot(`
      "
            import { releaseVersion } from 'buildscale/release';
            const { releaseChangelog } = require("buildscale/release");
          "
    `);

    // buildscale/changelog-renderer references should be updated to buildscale/release/changelog-renderer
    expect(readJson(tree, 'buildscale.json')).toMatchInlineSnapshot(`
      {
        "$schema": "./node_modules/buildscale/schemas/buildscale-schema.json",
        "release": {
          "changelog": {
            "git": {
              "commit": true,
              "tag": true,
            },
            "projectChangelogs": {
              "renderer": "buildscale/release/changelog-renderer",
            },
            "workspaceChangelog": {
              "createRelease": "github",
              "renderer": "buildscale/release/changelog-renderer",
            },
          },
          "version": {
            "generatorOptions": {
              "currentVersionResolver": "git-tag",
              "specifierSource": "conventional-commits",
            },
          },
        },
      }
    `);
  });
});
