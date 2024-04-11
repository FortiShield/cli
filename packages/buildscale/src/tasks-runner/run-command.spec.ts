import { TasksRunner } from './tasks-runner';
import { getRunner } from './run-command';
import { BuildscaleJsonConfiguration } from '../config/buildscale-json';
import { join } from 'path';
import { buildscaleCloudTasksRunnerShell } from '../buildscale-cloud/buildscale-cloud-tasks-runner-shell';
import { withEnvironmentVariables } from '../internal-testing-utils/with-environment';

describe('getRunner', () => {
  let buildscaleJson: BuildscaleJsonConfiguration;
  let mockRunner: TasksRunner;
  let overrides: any;

  beforeEach(() => {
    buildscaleJson = {};
    mockRunner = jest.fn();
  });

  it('gets a custom task runner', () => {
    jest.mock('custom-runner', () => mockRunner, {
      virtual: true,
    });

    buildscaleJson.tasksRunnerOptions = {
      custom: {
        runner: 'custom-runner',
      },
    };

    const { tasksRunner, runnerOptions } = getRunner(
      { runner: 'custom' },
      buildscaleJson
    );

    expect(tasksRunner).toEqual(mockRunner);
  });

  it('gets a custom task runner with options', () => {
    jest.mock('custom-runner2', () => mockRunner, {
      virtual: true,
    });

    buildscaleJson.tasksRunnerOptions = {
      custom: {
        runner: 'custom-runner2',
        options: {
          runnerOption: 'runner-option',
        },
      },
    };

    const { tasksRunner, runnerOptions } = getRunner(
      { runner: 'custom' },
      buildscaleJson
    );
    expect(tasksRunner).toBe(mockRunner);
    expect(runnerOptions).toEqual({
      runner: 'custom',
      runnerOption: 'runner-option',
    });
  });

  it('gets a custom defined default task runner', () => {
    jest.mock('custom-default-runner', () => mockRunner, {
      virtual: true,
    });

    buildscaleJson.tasksRunnerOptions = {
      default: {
        runner: 'custom-default-runner',
      },
    };

    const { tasksRunner } = getRunner({}, buildscaleJson);

    expect(tasksRunner).toEqual(mockRunner);
  });

  it('uses default runner when no tasksRunnerOptions are present', () => {
    jest.mock(join(__dirname, './default-tasks-runner.ts'), () => mockRunner);

    const { tasksRunner } = withEnvironmentVariables(
      {
        BUILDSCALE_CLOUD_ACCESS_TOKEN: undefined,
      },
      () => getRunner({}, {})
    );

    expect(tasksRunner).toEqual(mockRunner);
  });

  it('uses buildscale-cloud when no tasksRunnerOptions are present and accessToken is specified', () => {
    const { tasksRunner, runnerOptions } = getRunner(
      {},
      {
        buildscaleCloudAccessToken: 'XXXX-XXX-XXXX',
        buildscaleCloudUrl: 'https://my-buildscale-cloud.app',
      }
    );

    expect(tasksRunner).toEqual(buildscaleCloudTasksRunnerShell);
    expect(runnerOptions).toMatchInlineSnapshot(`
      {
        "accessToken": "XXXX-XXX-XXXX",
        "url": "https://my-buildscale-cloud.app",
      }
    `);
  });

  it('uses cloud runner when tasksRunnerOptions are not present and accessToken is set in env', () => {
    const { tasksRunner } = withEnvironmentVariables(
      {
        BUILDSCALE_CLOUD_ACCESS_TOKEN: 'xxx-xx-xxx',
      },
      () => getRunner({}, {})
    );
    expect(tasksRunner).toEqual(buildscaleCloudTasksRunnerShell);
  });

  it('reads options from base properties if no runner options provided', () => {
    jest.mock(join(__dirname, './default-tasks-runner.ts'), () => mockRunner);

    const { runnerOptions } = getRunner(
      {},
      {
        cacheDirectory: '.buildscale/cache',
        parallel: 3,
        useDaemonProcess: false,
        targetDefaults: {
          build: {
            cache: true,
          },
        },
      }
    );

    expect(runnerOptions).toMatchInlineSnapshot(`
      {
        "cacheDirectory": ".buildscale/cache",
        "cacheableOperations": [
          "build",
        ],
        "parallel": 3,
        "useDaemonProcess": false,
      }
    `);
  });
});
