import * as memfs from 'memfs';

import '../../internal-testing-utils/mock-fs';

import { getTargetInfo, TargetDefaultsPlugin } from './target-defaults-plugin';
import { CreateNodesContext } from '../../project-graph/plugins';
const {
  createNodes: [, createNodesFn],
} = TargetDefaultsPlugin;

describe('target-defaults plugin', () => {
  let context: CreateNodesContext;
  beforeEach(() => {
    context = {
      buildscaleJsonConfiguration: {
        targetDefaults: {
          build: {
            dependsOn: ['^build'],
          },
        },
      },
      workspaceRoot: '/root',
      configFiles: [],
    };
  });

  afterEach(() => {
    memfs.vol.reset();
  });

  it('should add target default info to project json projects', () => {
    memfs.vol.fromJSON(
      {
        'project.json': JSON.stringify({
          name: 'root',
          targets: { echo: { command: 'echo root project' } },
        }),
        'packages/lib-a/project.json': JSON.stringify({
          name: 'lib-a',
          targets: {
            build: {
              executor: 'buildscale:run-commands',
              options: {},
            },
          },
        }),
      },
      '/root'
    );

    expect(createNodesFn('project.json', undefined, context))
      .toMatchInlineSnapshot(`
      {
        "BUILDSCALE_OVERRIDE_SOURCE_FILE": "buildscale.json",
        "projects": {
          ".": {
            "targets": {
              "build": {
                "BUILDSCALE_ONLY_MODIFIES_EXISTING_TARGET": true,
                "dependsOn": [
                  "^build",
                ],
              },
            },
          },
        },
      }
    `);
    expect(createNodesFn('packages/lib-a/project.json', undefined, context))
      .toMatchInlineSnapshot(`
      {
        "BUILDSCALE_OVERRIDE_SOURCE_FILE": "buildscale.json",
        "projects": {
          "packages/lib-a": {
            "targets": {
              "build": {
                "dependsOn": [
                  "^build",
                ],
                "executor": "buildscale:run-commands",
              },
            },
          },
        },
      }
    `);
  });

  it('should add target if package.json has buildscale but no includedScripts', () => {
    memfs.vol.fromJSON(
      {
        'package.json': JSON.stringify({
          name: 'lib-a',
          scripts: {
            test: 'buildscale affected:test',
          },
          buildscale: {},
        }),
      },
      '/root'
    );

    expect(
      createNodesFn('package.json', undefined, {
        buildscaleJsonConfiguration: {
          targetDefaults: {
            test: {
              command: 'jest',
            },
          },
        },
        workspaceRoot: '/root',
        configFiles: [],
      })
    ).toMatchInlineSnapshot(`
      {
        "BUILDSCALE_OVERRIDE_SOURCE_FILE": "buildscale.json",
        "projects": {
          ".": {
            "targets": {
              "test": {
                "command": "jest",
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

  it('should add target if package.json has buildscale and includes the script in includedScripts', () => {
    memfs.vol.fromJSON(
      {
        'package.json': JSON.stringify({
          name: 'lib-a',
          scripts: {
            test: 'buildscale affected:test',
          },
          buildscale: {
            includedScripts: ['test'],
          },
        }),
      },
      '/root'
    );

    expect(
      createNodesFn('package.json', undefined, {
        buildscaleJsonConfiguration: {
          targetDefaults: {
            test: {
              command: 'jest',
            },
          },
        },
        workspaceRoot: '/root',
        configFiles: [],
      })
    ).toMatchInlineSnapshot(`
      {
        "BUILDSCALE_OVERRIDE_SOURCE_FILE": "buildscale.json",
        "projects": {
          ".": {
            "targets": {
              "test": {
                "command": "jest",
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

  it('should not add target if package.json does not have buildscale', () => {
    memfs.vol.fromJSON(
      {
        'package.json': JSON.stringify({
          name: 'lib-a',
          scripts: {
            test: 'buildscale affected:test',
          },
        }),
      },
      '/root'
    );

    expect(
      createNodesFn('package.json', undefined, {
        buildscaleJsonConfiguration: {
          targetDefaults: {
            test: {
              command: 'jest',
            },
          },
        },
        workspaceRoot: '/root',
        configFiles: [],
      })
    ).toMatchInlineSnapshot(`{}`);
  });

  it('should only modify target if package json has script but its not included', () => {
    memfs.vol.fromJSON(
      {
        'package.json': JSON.stringify({
          name: 'lib-a',
          scripts: {
            test: 'buildscale affected:test',
          },
          buildscale: {
            includedScripts: [],
          },
        }),
      },
      '/root'
    );

    expect(
      createNodesFn('package.json', undefined, {
        buildscaleJsonConfiguration: {
          targetDefaults: {
            test: {
              command: 'jest',
            },
          },
        },
        workspaceRoot: '/root',
        configFiles: [],
      })
    ).toMatchInlineSnapshot(`
      {
        "BUILDSCALE_OVERRIDE_SOURCE_FILE": "buildscale.json",
        "projects": {
          ".": {
            "targets": {
              "test": {
                "BUILDSCALE_ONLY_MODIFIES_EXISTING_TARGET": true,
                "command": "jest",
              },
            },
          },
        },
      }
    `);
  });

  it('should not register target if target default and package.json target if package.json target is not included script', async () => {
    memfs.vol.fromJSON(
      {
        'package.json': JSON.stringify({
          name: 'lib-a',
          scripts: {
            test: 'buildscale affected:test',
          },
          buildscale: {
            includedScripts: [],
            targets: {
              test: {
                outputs: ['coverage'],
              },
            },
          },
        }),
      },
      '/root'
    );

    const result = await createNodesFn('package.json', undefined, {
      buildscaleJsonConfiguration: {
        targetDefaults: {
          test: {
            cache: true,
          },
        },
      },
      workspaceRoot: '/root',
      configFiles: [],
    });

    const { targets } = result.projects['.'];

    // Info from target defaults will be merged
    expect(targets.test.cache).toBeTruthy();
    // Info from package.json will not be merged at this time - it will be merged when processing package json plugin
    expect(targets.test.outputs).not.toBeDefined();
  });

  it('should register target if target default and package.json target if package.json target is not included script but has executor', async () => {
    memfs.vol.fromJSON(
      {
        'package.json': JSON.stringify({
          name: 'lib-a',
          scripts: {
            test: 'buildscale affected:test',
          },
          buildscale: {
            includedScripts: [],
            targets: {
              test: {
                executor: 'buildscale:run-commands',
                options: {
                  command: 'echo hi',
                },
              },
            },
          },
        }),
      },
      '/root'
    );

    const result = await createNodesFn('package.json', undefined, {
      buildscaleJsonConfiguration: {
        targetDefaults: {
          test: {
            cache: true,
          },
        },
      },
      workspaceRoot: '/root',
      configFiles: [],
    });

    const { targets } = result.projects['.'];

    // Info from target defaults will be merged
    expect(targets.test.cache).toBeTruthy();
    // Info from package.json will be merged so that the target default is compatible
    expect(targets.test.executor).toEqual('buildscale:run-commands');
  });

  describe('executor key', () => {
    it('should support multiple targets with the same executor', () => {
      memfs.vol.fromJSON(
        {
          'project.json': JSON.stringify({
            name: 'root',
            targets: {
              echo: {
                executor: 'buildscale:run-commands',
                options: {
                  command: 'echo 1',
                },
              },
              echo2: {
                executor: 'buildscale:run-commands',
                options: {
                  command: 'echo 2',
                },
              },
            },
          }),
        },
        '/root'
      );

      context.buildscaleJsonConfiguration.targetDefaults = {
        'buildscale:run-commands': {
          options: {
            cwd: '{projectRoot}',
          },
        },
      };

      expect(createNodesFn('project.json', undefined, context))
        .toMatchInlineSnapshot(`
        {
          "BUILDSCALE_OVERRIDE_SOURCE_FILE": "buildscale.json",
          "projects": {
            ".": {
              "targets": {
                "echo": {
                  "executor": "buildscale:run-commands",
                  "options": {
                    "cwd": "{projectRoot}",
                  },
                },
                "echo2": {
                  "executor": "buildscale:run-commands",
                  "options": {
                    "cwd": "{projectRoot}",
                  },
                },
                "buildscale:run-commands": {
                  "BUILDSCALE_ONLY_MODIFIES_EXISTING_TARGET": true,
                  "options": {
                    "cwd": "{projectRoot}",
                  },
                },
              },
            },
          },
        }
      `);
    });

    it('should not be overridden by target name based default', () => {
      memfs.vol.fromJSON(
        {
          'project.json': JSON.stringify({
            name: 'root',
            targets: {
              echo: {
                executor: 'buildscale:run-commands',
                options: {
                  command: 'echo 1',
                },
              },
              echo2: {
                executor: 'buildscale:run-commands',
                options: {
                  command: 'echo 2',
                },
              },
            },
          }),
        },
        '/root'
      );

      context.buildscaleJsonConfiguration.targetDefaults = {
        'buildscale:run-commands': {
          options: {
            cwd: '{projectRoot}',
          },
        },
        echo: {},
      };

      expect(createNodesFn('project.json', undefined, context))
        .toMatchInlineSnapshot(`
        {
          "BUILDSCALE_OVERRIDE_SOURCE_FILE": "buildscale.json",
          "projects": {
            ".": {
              "targets": {
                "echo": {
                  "executor": "buildscale:run-commands",
                  "options": {
                    "cwd": "{projectRoot}",
                  },
                },
                "echo2": {
                  "executor": "buildscale:run-commands",
                  "options": {
                    "cwd": "{projectRoot}",
                  },
                },
                "buildscale:run-commands": {
                  "BUILDSCALE_ONLY_MODIFIES_EXISTING_TARGET": true,
                  "options": {
                    "cwd": "{projectRoot}",
                  },
                },
              },
            },
          },
        }
      `);
    });
  });

  describe('get target info', () => {
    it('should include command for single command', () => {
      const result = getTargetInfo(
        'echo',
        {
          echo: {
            command: 'echo hi',
          },
        },
        null
      );
      expect(result).toMatchInlineSnapshot(`
        {
          "command": "echo hi",
        }
      `);
    });

    it('should include command for run-commands', () => {
      const result = getTargetInfo(
        'echo',
        {
          echo: {
            executor: 'buildscale:run-commands',
            options: {
              command: 'echo hi',
              cwd: '{projectRoot}',
            },
          },
        },
        null
      );
      expect(result).toMatchInlineSnapshot(`
        {
          "executor": "buildscale:run-commands",
          "options": {
            "command": "echo hi",
          },
        }
      `);
    });

    it('should include script for run-script', () => {
      expect(
        getTargetInfo('build', null, {
          build: {
            executor: 'buildscale:run-script',
            options: {
              script: 'build',
            },
          },
        })
      ).toMatchInlineSnapshot(`
        {
          "executor": "buildscale:run-script",
          "options": {
            "script": "build",
          },
        }
      `);
    });
  });
});
