import { BuildscaleJsonConfiguration } from '../../config/buildscale-json';
import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import { readJson, writeJson } from '../../generators/utils/json';
import { Tree } from '../../generators/tree';

const verifyOrUpdateBuildscaleCloudClient = jest.fn();
jest.mock('../../buildscale-cloud/update-manager', () => ({
  ...jest.requireActual('../../buildscale-cloud/update-manager'),
  verifyOrUpdateBuildscaleCloudClient,
}));
import migrate from './use-minimal-config-for-tasks-runner-options';

describe('use-minimal-config-for-tasks-runner-options migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should update buildscale.json with minimal config', async () => {
    writeJson<BuildscaleJsonConfiguration>(tree, 'buildscale.json', {
      tasksRunnerOptions: {
        default: {
          runner: 'buildscale/tasks-runners/default',
          options: {
            cacheableOperations: ['build', 'test'],
          },
        },
      },
    });

    await migrate(tree);

    const buildscaleJson = readJson<BuildscaleJsonConfiguration>(tree, 'buildscale.json');
    expect(buildscaleJson.tasksRunnerOptions).toEqual(undefined);
    expect(buildscaleJson.targetDefaults).toMatchInlineSnapshot(`
      {
        "build": {
          "cache": true,
        },
        "test": {
          "cache": true,
        },
      }
    `);
  });

  it('should not update buildscale.json if there are multiple tasks runners', async () => {
    writeJson<BuildscaleJsonConfiguration>(tree, 'buildscale.json', {
      tasksRunnerOptions: {
        default: {
          runner: 'buildscale/tasks-runners/default',
          options: {},
        },
        custom: {
          runner: 'custom',
          options: {},
        },
      },
    });

    await migrate(tree);

    const buildscaleJson = readJson<BuildscaleJsonConfiguration>(tree, 'buildscale.json');
    expect(buildscaleJson.tasksRunnerOptions).toEqual({
      default: {
        runner: 'buildscale/tasks-runners/default',
        options: {},
      },
      custom: {
        runner: 'custom',
        options: {},
      },
    });
  });

  it('should move buildscaleCloudAccessToken and buildscaleCloudUrl for buildscale-cloud', async () => {
    writeJson<BuildscaleJsonConfiguration>(tree, 'buildscale.json', {
      tasksRunnerOptions: {
        default: {
          runner: 'buildscale-cloud',
          options: {
            accessToken: 'abc123',
            url: 'https://buildscale.app',
            encryptionKey: 'secret',
          },
        },
      },
    });
    writeJson(tree, 'package.json', {
      devDependencies: {
        'buildscale-cloud': 'latest',
        buildscale: 'latest',
      },
    });

    await migrate(tree);

    const buildscaleJson = readJson<BuildscaleJsonConfiguration>(tree, 'buildscale.json');
    expect(buildscaleJson.buildscaleCloudAccessToken).toEqual('abc123');
    expect(buildscaleJson.buildscaleCloudUrl).toEqual('https://buildscale.app');
    expect(buildscaleJson.buildscaleCloudEncryptionKey).toEqual('secret');
    expect(buildscaleJson.tasksRunnerOptions).not.toBeDefined();

    expect(readJson(tree, 'package.json').devDependencies).toEqual({
      buildscale: 'latest',
    });
  });

  it('should move buildscaleCloudAccessToken and buildscaleCloudUrl for @nrwl/buildscale-cloud', async () => {
    writeJson<BuildscaleJsonConfiguration>(tree, 'buildscale.json', {
      tasksRunnerOptions: {
        default: {
          runner: '@nrwl/buildscale-cloud',
          options: {
            accessToken: 'abc123',
            url: 'https://buildscale.app',
            maskedProperties: 'secret',
          },
        },
      },
    });

    await migrate(tree);

    const buildscaleJson = readJson<BuildscaleJsonConfiguration>(tree, 'buildscale.json');
    expect(buildscaleJson.buildscaleCloudAccessToken).toEqual('abc123');
    expect(buildscaleJson.buildscaleCloudUrl).toEqual('https://buildscale.app');
    expect(buildscaleJson.tasksRunnerOptions.default.options).toMatchInlineSnapshot(`
      {
        "maskedProperties": "secret",
      }
    `);
    expect(buildscaleJson.tasksRunnerOptions.default.runner).not.toBeDefined();
  });

  it('should add useLightClient false for outdated enterprise customers', async () => {
    writeJson<BuildscaleJsonConfiguration>(tree, 'buildscale.json', {
      tasksRunnerOptions: {
        default: {
          runner: 'buildscale-cloud',
          options: {
            accessToken: 'abc123',
            url: 'https://buildscale-cloud.example.com',
          },
        },
      },
    });
    verifyOrUpdateBuildscaleCloudClient.mockImplementation(() => {
      throw new Error();
    });

    await migrate(tree);

    const buildscaleJson = readJson<BuildscaleJsonConfiguration>(tree, 'buildscale.json');
    expect(buildscaleJson.buildscaleCloudAccessToken).toEqual('abc123');
    expect(buildscaleJson.buildscaleCloudUrl).toEqual('https://buildscale-cloud.example.com');
    expect(buildscaleJson.tasksRunnerOptions.default.options).toMatchInlineSnapshot(`
      {
        "useLightClient": false,
      }
    `);
    expect(buildscaleJson.tasksRunnerOptions.default.runner).not.toBeDefined();
  });

  it('should not update accessToken if runner is not buildscale-cloud', async () => {
    writeJson<BuildscaleJsonConfiguration>(tree, 'buildscale.json', {
      tasksRunnerOptions: {
        default: {
          runner: 'custom',
          options: {
            cacheDirectory: '.buildscale/cache',
            useDaemonProcess: false,
            accessToken: 'xxxx-xxx-xxxx',
          },
        },
      },
    });
    await migrate(tree);
    expect(readJson<BuildscaleJsonConfiguration>(tree, 'buildscale.json'))
      .toMatchInlineSnapshot(`
      {
        "cacheDirectory": ".buildscale/cache",
        "tasksRunnerOptions": {
          "default": {
            "options": {
              "accessToken": "xxxx-xxx-xxxx",
            },
            "runner": "custom",
          },
        },
        "useDaemonProcess": false,
      }
    `);
  });

  it('should work if buildscale.json does not exist', async () => {
    tree.delete('buildscale.json');
    await migrate(tree);
    expect(tree.exists('buildscale.json')).toEqual(false);
  });

  it('should not throw is cacheableOperations is an unexpected type', async () => {
    writeJson<BuildscaleJsonConfiguration>(tree, 'buildscale.json', {
      tasksRunnerOptions: {
        default: {
          runner: 'buildscale/tasks-runners/default',
          options: {
            cacheableOperations: 'invalid',
          },
        },
      },
    });

    await migrate(tree);

    const buildscaleJson = readJson<BuildscaleJsonConfiguration>(tree, 'buildscale.json');
    expect(buildscaleJson.tasksRunnerOptions).toMatchInlineSnapshot(`
      {
        "default": {
          "options": {
            "cacheableOperations": "invalid",
          },
        },
      }
    `);
  });
});
