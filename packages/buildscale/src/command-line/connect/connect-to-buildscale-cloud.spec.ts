import { withEnvironmentVariables } from '../../internal-testing-utils/with-environment';
import { onlyDefaultRunnerIsUsed } from './connect-to-buildscale-cloud';

describe('connect-to-buildscale-cloud', () => {
  describe('onlyDefaultRunnerIsUsed', () => {
    it('should say no if tasks runner options is undefined and buildscaleCloudAccessToken is set', () => {
      expect(
        withEnvironmentVariables(
          {
            BUILDSCALE_CLOUD_ACCESS_TOKEN: null,
          },
          () =>
            onlyDefaultRunnerIsUsed({
              buildscaleCloudAccessToken: 'xxx-xx-xxx',
            })
        )
      ).toBe(false);
    });

    it('should say no if cloud access token is in env', () => {
      const defaultRunnerUsed = withEnvironmentVariables(
        {
          BUILDSCALE_CLOUD_ACCESS_TOKEN: 'xxx-xx-xxx',
        },
        () => onlyDefaultRunnerIsUsed({})
      );

      expect(defaultRunnerUsed).toBe(false);
    });

    it('should say yes if tasks runner options is undefined and buildscaleCloudAccessToken is not set', () => {
      expect(
        withEnvironmentVariables(
          {
            BUILDSCALE_CLOUD_ACCESS_TOKEN: null,
          },
          () => onlyDefaultRunnerIsUsed({})
        )
      ).toBe(true);
    });

    it('should say yes if tasks runner options is set to default runner', () => {
      expect(
        withEnvironmentVariables(
          {
            BUILDSCALE_CLOUD_ACCESS_TOKEN: null,
          },
          () =>
            onlyDefaultRunnerIsUsed({
              tasksRunnerOptions: {
                default: {
                  runner: 'buildscale/tasks-runners/default',
                },
              },
            })
        )
      ).toBeTruthy();
    });

    it('should say no if tasks runner is set to a custom runner', () => {
      expect(
        withEnvironmentVariables(
          {
            BUILDSCALE_CLOUD_ACCESS_TOKEN: null,
          },
          () =>
            onlyDefaultRunnerIsUsed({
              tasksRunnerOptions: {
                default: {
                  runner: 'custom-runner',
                },
              },
            })
        )
      ).toBeFalsy();
    });

    it('should say yes if tasks runner has options, but no runner and not using cloud', () => {
      expect(
        withEnvironmentVariables(
          {
            BUILDSCALE_CLOUD_ACCESS_TOKEN: null,
          },
          () =>
            onlyDefaultRunnerIsUsed({
              tasksRunnerOptions: {
                default: {
                  options: {
                    foo: 'bar',
                  },
                },
              },
            })
        )
      ).toBeTruthy();
    });

    it('should say no if tasks runner has options, but no runner and using cloud', () => {
      expect(
        withEnvironmentVariables(
          {
            BUILDSCALE_CLOUD_ACCESS_TOKEN: null,
          },
          () =>
            onlyDefaultRunnerIsUsed({
              tasksRunnerOptions: {
                default: {
                  options: {
                    foo: 'bar',
                  },
                },
              },
              buildscaleCloudAccessToken: 'xxx-xx-xxx',
            })
        )
      ).toBeFalsy();
    });
  });
});
