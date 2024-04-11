import { splitArgsIntoBuildscaleArgsAndOverrides } from './command-line-utils';
import { withEnvironmentVariables as withEnvironment } from '../internal-testing-utils/with-environment';

jest.mock('../project-graph/file-utils');

describe('splitArgs', () => {
  let originalBase: string;
  let originalHead: string;

  beforeEach(() => {
    originalBase = process.env.BUILDSCALE_BASE;
    originalHead = process.env.BUILDSCALE_HEAD;

    delete process.env.BUILDSCALE_BASE;
    delete process.env.BUILDSCALE_HEAD;
  });

  afterEach(() => {
    process.env.BUILDSCALE_BASE = originalBase;
    process.env.BUILDSCALE_HEAD = originalHead;
  });

  it('should split buildscale specific arguments into buildscaleArgs', () => {
    expect(
      splitArgsIntoBuildscaleArgsAndOverrides(
        {
          base: 'sha1',
          head: 'sha2',
          __overrides_unparsed__: ['--notBuildscaleArg', '--override'],
          $0: '',
        },
        'affected',
        {} as any,
        {} as any
      ).buildscaleArgs
    ).toEqual({
      base: 'sha1',
      head: 'sha2',
      skipBuildscaleCache: false,
    });
  });

  it('should put every command start with buildscale to buildscaleArgs', () => {
    const buildscaleArgs = splitArgsIntoBuildscaleArgsAndOverrides(
      {
        buildscaleBail: 'some-value',
        __overrides_unparsed__: ['--override'],
        $0: '',
      },
      'affected',
      {} as any,
      {} as any
    ).buildscaleArgs;
    expect(buildscaleArgs['buildscaleBail']).toEqual('some-value');
  });

  it('should default to having a base of main', () => {
    expect(
      splitArgsIntoBuildscaleArgsAndOverrides(
        {
          __overrides_unparsed__: ['--notBuildscaleArg', '--override'],
          $0: '',
        },
        'affected',
        {} as any,
        {} as any
      ).buildscaleArgs
    ).toEqual({
      base: 'main',
      skipBuildscaleCache: false,
    });
  });

  it('should return configured base branch from buildscale.json', () => {
    expect(
      splitArgsIntoBuildscaleArgsAndOverrides(
        {
          __overrides_unparsed__: ['--notBuildscaleArg', '--override'],
          $0: '',
        },
        'affected',
        {} as any,
        { affected: { defaultBase: 'develop' } }
      ).buildscaleArgs
    ).toEqual({
      base: 'develop',
      skipBuildscaleCache: false,
    });
  });

  it('should return a default base branch if not configured in buildscale.json', () => {
    expect(
      splitArgsIntoBuildscaleArgsAndOverrides(
        {
          __overrides_unparsed__: ['--notBuildscaleArg', 'affecteda', '--override'],
          $0: '',
        },
        'affected',
        {} as any,
        {} as any
      ).buildscaleArgs
    ).toEqual({
      base: 'main',
      skipBuildscaleCache: false,
    });
  });

  it('should split non buildscale specific arguments into target args', () => {
    expect(
      splitArgsIntoBuildscaleArgsAndOverrides(
        {
          files: [''],
          __overrides_unparsed__: ['--notBuildscaleArg'],
          $0: '',
        },
        'affected',
        {} as any,
        {} as any
      ).overrides
    ).toEqual({
      __overrides_unparsed__: ['--notBuildscaleArg'],
      notBuildscaleArg: true,
    });
  });

  it('should split non buildscale specific arguments into target args (with positonal args)', () => {
    expect(
      splitArgsIntoBuildscaleArgsAndOverrides(
        {
          files: [''],
          __overrides_unparsed__: ['positional', '--notBuildscaleArg'],
          $0: '',
        },
        'affected',
        {} as any,
        {} as any
      ).overrides
    ).toEqual({
      _: ['positional'],
      __overrides_unparsed__: ['positional', '--notBuildscaleArg'],
      notBuildscaleArg: true,
    });
  });

  it('should only use explicitly provided overrides', () => {
    expect(
      splitArgsIntoBuildscaleArgsAndOverrides(
        {
          files: [''],
          __overrides_unparsed__: ['explicit'],
          $0: '',
        },
        'affected',
        {} as any,
        {} as any
      ).overrides
    ).toEqual({
      __overrides_unparsed__: ['explicit'],
      _: ['explicit'],
    });
  });

  it('should be able to parse arguments in __overrides__', () => {
    expect(
      splitArgsIntoBuildscaleArgsAndOverrides(
        {
          files: [''],
          __overrides__: ['explicit'],
          $0: '',
        },
        'affected',
        {} as any,
        {} as any
      ).overrides
    ).toEqual({
      __overrides_unparsed__: ['explicit'],
      _: ['explicit'],
    });
  });

  it('should split projects when it is a string', () => {
    expect(
      splitArgsIntoBuildscaleArgsAndOverrides(
        {
          projects: 'aaa,bbb',
          __overrides_unparsed__: [],
          $0: '',
        },
        'run-many',
        {} as any,
        {} as any
      ).buildscaleArgs
    ).toEqual({
      projects: ['aaa', 'bbb'],
      skipBuildscaleCache: false,
    });
  });

  it('should set base and head based on environment variables in affected mode, if they are not provided directly on the command', () => {
    withEnvironment(
      {
        BUILDSCALE_BASE: 'envVarSha1',
        BUILDSCALE_HEAD: 'envVarSha2',
      },
      () => {
        expect(
          splitArgsIntoBuildscaleArgsAndOverrides(
            {
              __overrides_unparsed__: ['--notBuildscaleArg', 'true', '--override'],
              $0: '',
            },
            'affected',
            {} as any,
            {} as any
          ).buildscaleArgs
        ).toEqual({
          base: 'envVarSha1',
          head: 'envVarSha2',
          skipBuildscaleCache: false,
        });

        expect(
          splitArgsIntoBuildscaleArgsAndOverrides(
            {
              __overrides_unparsed__: ['--notBuildscaleArg', 'true', '--override'],
              $0: '',
              head: 'directlyOnCommandSha1', // higher priority than $BUILDSCALE_HEAD
            },
            'affected',
            {} as any,
            {} as any
          ).buildscaleArgs
        ).toEqual({
          base: 'envVarSha1',
          head: 'directlyOnCommandSha1',
          skipBuildscaleCache: false,
        });

        expect(
          splitArgsIntoBuildscaleArgsAndOverrides(
            {
              __overrides_unparsed__: ['--notBuildscaleArg', 'true', '--override'],
              $0: '',
              base: 'directlyOnCommandSha2', // higher priority than $BUILDSCALE_BASE
            },
            'affected',
            {} as any,
            {} as any
          ).buildscaleArgs
        ).toEqual({
          base: 'directlyOnCommandSha2',
          head: 'envVarSha2',
          skipBuildscaleCache: false,
        });
      }
    );
  });

  describe('--runner environment handling', () => {
    it('should set runner based on environment BUILDSCALE_RUNNER, if it is not provided directly on the command', () => {
      withEnvironment({ BUILDSCALE_RUNNER: 'some-env-runner-name' }, () => {
        expect(
          splitArgsIntoBuildscaleArgsAndOverrides(
            {
              __overrides_unparsed__: ['--notBuildscaleArg', 'true', '--override'],
              $0: '',
            },
            'run-one',
            {} as any,
            {
              tasksRunnerOptions: {
                'some-env-runner-name': { runner: '' },
              },
            }
          ).buildscaleArgs.runner
        ).toEqual('some-env-runner-name');

        expect(
          splitArgsIntoBuildscaleArgsAndOverrides(
            {
              __overrides_unparsed__: ['--notBuildscaleArg', 'true', '--override'],
              $0: '',
              runner: 'directlyOnCommand', // higher priority than $BUILDSCALE_RUNNER
            },
            'run-one',
            {} as any,
            {
              tasksRunnerOptions: {
                'some-env-runner-name': { runner: '' },
              },
            }
          ).buildscaleArgs.runner
        ).toEqual('directlyOnCommand');
      });
    });

    it('should set runner based on environment BUILDSCALE_TASKS_RUNNER, if it is not provided directly on the command', () => {
      withEnvironment({ BUILDSCALE_TASKS_RUNNER: 'some-env-runner-name' }, () => {
        expect(
          splitArgsIntoBuildscaleArgsAndOverrides(
            {
              __overrides_unparsed__: ['--notBuildscaleArg', 'true', '--override'],
              $0: '',
            },
            'run-one',
            {} as any,
            {
              tasksRunnerOptions: {
                'some-env-runner-name': { runner: '' },
              },
            }
          ).buildscaleArgs.runner
        ).toEqual('some-env-runner-name');

        expect(
          splitArgsIntoBuildscaleArgsAndOverrides(
            {
              __overrides_unparsed__: ['--notBuildscaleArg', 'true', '--override'],
              $0: '',
              runner: 'directlyOnCommand', // higher priority than $BUILDSCALE_RUNNER
            },
            'run-one',
            {} as any,
            {
              tasksRunnerOptions: {
                'some-env-runner-name': { runner: '' },
              },
            }
          ).buildscaleArgs.runner
        ).toEqual('directlyOnCommand');
      });
    });

    it('should prefer BUILDSCALE_TASKS_RUNNER', () => {
      withEnvironment(
        {
          BUILDSCALE_TASKS_RUNNER: 'some-env-runner-name',
          BUILDSCALE_RUNNER: 'some-other-runner',
        },
        () => {
          expect(
            splitArgsIntoBuildscaleArgsAndOverrides(
              {
                __overrides_unparsed__: ['--notBuildscaleArg', 'true', '--override'],
                $0: '',
              },
              'run-one',
              {} as any,
              {
                tasksRunnerOptions: {
                  'some-env-runner-name': { runner: '' },
                  'some-other-runner': { runner: '' },
                },
              }
            ).buildscaleArgs.runner
          ).toEqual('some-env-runner-name');
        }
      );
    });

    it('should ignore runners based on environment, if it is valid', () => {
      withEnvironment(
        {
          BUILDSCALE_TASKS_RUNNER: 'some-env-runner-name',
          BUILDSCALE_RUNNER: 'some-other-runner',
        },
        () => {
          expect(
            splitArgsIntoBuildscaleArgsAndOverrides(
              {
                __overrides_unparsed__: ['--notBuildscaleArg', 'true', '--override'],
                $0: '',
              },
              'run-one',
              {} as any,
              {} as any
            ).buildscaleArgs.runner
          ).not.toBeDefined();
        }
      );
    });
  });

  describe('--parallel', () => {
    it('should be a number', () => {
      const parallel = splitArgsIntoBuildscaleArgsAndOverrides(
        {
          $0: '',
          __overrides_unparsed__: [],
          parallel: '5',
        },
        'affected',
        {} as any,
        {} as any
      ).buildscaleArgs.parallel;

      expect(parallel).toEqual(5);
    });

    it('should default to 3 when used with no value specified', () => {
      const parallel = splitArgsIntoBuildscaleArgsAndOverrides(
        {
          $0: '',
          __overrides_unparsed__: [],
          parallel: '',
        },
        'affected',
        {} as any,
        {} as any
      ).buildscaleArgs.parallel;

      expect(parallel).toEqual(3);
    });

    it('should be 3 when set to true', () => {
      const parallel = splitArgsIntoBuildscaleArgsAndOverrides(
        {
          $0: '',
          __overrides_unparsed__: [],
          parallel: 'true',
        },
        'affected',
        {} as any,
        {} as any
      ).buildscaleArgs.parallel;

      expect(parallel).toEqual(3);
    });

    it('should be 1 when set to false', () => {
      const parallel = splitArgsIntoBuildscaleArgsAndOverrides(
        {
          $0: '',
          __overrides_unparsed__: [],
          parallel: 'false',
        },
        'affected',
        {} as any,
        {} as any
      ).buildscaleArgs.parallel;

      expect(parallel).toEqual(1);
    });

    it('should use the maxParallel option when given', () => {
      const parallel = splitArgsIntoBuildscaleArgsAndOverrides(
        {
          $0: '',
          __overrides_unparsed__: [],
          parallel: '',
          maxParallel: 5,
        },
        'affected',
        {} as any,
        {} as any
      ).buildscaleArgs.parallel;

      expect(parallel).toEqual(5);
    });

    it('should use the maxParallel option when given', () => {
      const parallel = splitArgsIntoBuildscaleArgsAndOverrides(
        {
          $0: '',
          __overrides_unparsed__: [],
          parallel: '',
          maxParallel: 5,
        },
        'affected',
        {} as any,
        {} as any
      ).buildscaleArgs.parallel;

      expect(parallel).toEqual(5);
    });
  });
});
