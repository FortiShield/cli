import {
  createProjectFileMapCache as _createCache,
  extractCachedFileData,
  FileMapCache,
  shouldRecomputeWholeGraph,
} from './buildscale-deps-cache';
import { ProjectConfiguration } from '../config/workspace-json-project-json';
import { BuildscaleJsonConfiguration } from '../config/buildscale-json';
import { buildscaleVersion } from '../utils/versions';

describe('buildscale deps utils', () => {
  describe('shouldRecomputeWholeGraph', () => {
    it('should be false when nothing changes', () => {
      expect(
        shouldRecomputeWholeGraph(
          createCache({ version: '6.0' }),
          createPackageJsonDeps({}),
          createProjectsConfiguration({}),
          createBuildscaleJson({}),
          createTsConfigJson()
        )
      ).toEqual(false);
    });

    it('should be true if cache version is outdated', () => {
      expect(
        shouldRecomputeWholeGraph(
          createCache({ version: '4.0' }),
          createPackageJsonDeps({}),
          createProjectsConfiguration({}),
          createBuildscaleJson({}),
          createTsConfigJson()
        )
      ).toEqual(true);
    });

    it('should be true when version of buildscale changes', () => {
      expect(
        shouldRecomputeWholeGraph(
          createCache({
            buildscaleVersion: '12.0.1',
          }),
          createPackageJsonDeps({}),
          createProjectsConfiguration({}),
          createBuildscaleJson({}),
          createTsConfigJson()
        )
      ).toEqual(true);
    });

    it('should be true when a cached project is missing', () => {
      expect(
        shouldRecomputeWholeGraph(
          createCache({
            fileMap: {
              projectFileMap: {
                'renamed-mylib': [],
              } as any,
              nonProjectFiles: [],
            },
          }),
          createPackageJsonDeps({}),
          createProjectsConfiguration({}),
          createBuildscaleJson({}),
          createTsConfigJson()
        )
      ).toEqual(true);
    });

    it('should be true when a path mapping changes', () => {
      expect(
        shouldRecomputeWholeGraph(
          createCache({}),
          createPackageJsonDeps({}),
          createProjectsConfiguration({}),
          createBuildscaleJson({}),
          createTsConfigJson({ mylib: ['libs/mylib/changed.ts'] })
        )
      ).toEqual(true);
    });

    it('should be true when number of plugins changed', () => {
      expect(
        shouldRecomputeWholeGraph(
          createCache({}),
          createPackageJsonDeps({}),
          createProjectsConfiguration({}),
          createBuildscaleJson({
            plugins: ['plugin', 'plugin2'],
          }),
          createTsConfigJson()
        )
      ).toEqual(true);
    });

    it('should be true when plugin version changed', () => {
      expect(
        shouldRecomputeWholeGraph(
          createCache({}),
          createPackageJsonDeps({ plugin: '2.0.0' }),
          createProjectsConfiguration({}),
          createBuildscaleJson({}),
          createTsConfigJson()
        )
      ).toEqual(true);
    });

    it('should be true when plugin config changes', () => {
      expect(
        shouldRecomputeWholeGraph(
          createCache({}),
          createPackageJsonDeps({ plugin: '2.0.0' }),
          createProjectsConfiguration({}),
          createBuildscaleJson({ pluginsConfig: { somePlugin: { one: 1 } } }),
          createTsConfigJson()
        )
      ).toEqual(true);
    });
  });

  describe('extractCachedPartOfProjectGraph', () => {
    it('should return the cache project graph when nothing has changed', () => {
      const r = extractCachedFileData(
        {
          nonProjectFiles: [],
          projectFileMap: {
            mylib: [
              {
                file: 'index.ts',
                hash: 'hash1',
              },
            ],
          },
        },
        createCache({
          fileMap: {
            nonProjectFiles: [],
            projectFileMap: {
              mylib: [
                {
                  file: 'index.ts',
                  hash: 'hash1',
                },
              ],
            },
          },
        })
      );
      expect(r.filesToProcess).toEqual({
        projectFileMap: {},
        nonProjectFiles: [],
      });
      expect(r.cachedFileData).toEqual({
        nonProjectFiles: {},
        projectFileMap: {
          mylib: {
            'index.ts': {
              file: 'index.ts',
              hash: 'hash1',
            },
          },
        },
      });
    });

    it('should handle cases when new projects are added', () => {
      const r = extractCachedFileData(
        {
          nonProjectFiles: [],
          projectFileMap: {
            mylib: [
              {
                file: 'index.ts',
                hash: 'hash1',
              },
            ],
            secondlib: [
              {
                file: 'index.ts',
                hash: 'hash2',
              },
            ],
          },
        },
        createCache({
          fileMap: {
            nonProjectFiles: [],
            projectFileMap: {
              mylib: [
                {
                  file: 'index.ts',
                  hash: 'hash1',
                },
              ],
            },
          },
        })
      );
      expect(r.filesToProcess).toEqual({
        projectFileMap: {
          secondlib: [
            {
              file: 'index.ts',
              hash: 'hash2',
            },
          ],
        },
        nonProjectFiles: [],
      });
      expect(r.cachedFileData).toEqual({
        nonProjectFiles: {},
        projectFileMap: {
          mylib: {
            'index.ts': {
              file: 'index.ts',
              hash: 'hash1',
            },
          },
        },
      });
    });

    it('should handle cases when files change', () => {
      const r = extractCachedFileData(
        {
          nonProjectFiles: [],
          projectFileMap: {
            mylib: [
              {
                file: 'index1.ts',
                hash: 'hash1',
              },
              {
                file: 'index2.ts',
                hash: 'hash2b',
              },
              {
                file: 'index4.ts',
                hash: 'hash4',
              },
            ],
          },
        },
        createCache({
          fileMap: {
            nonProjectFiles: [],
            projectFileMap: {
              mylib: [
                {
                  file: 'index1.ts',
                  hash: 'hash1',
                },
                {
                  file: 'index2.ts',
                  hash: 'hash2',
                },
                {
                  file: 'index3.ts',
                  hash: 'hash3',
                },
              ],
            },
          },
        })
      );
      expect(r.filesToProcess).toEqual({
        nonProjectFiles: [],
        projectFileMap: {
          mylib: [
            {
              file: 'index2.ts',
              hash: 'hash2b',
            },
            {
              file: 'index4.ts',
              hash: 'hash4',
            },
          ],
        },
      });
      expect(r.cachedFileData).toEqual({
        nonProjectFiles: {},
        projectFileMap: {
          mylib: {
            'index1.ts': {
              file: 'index1.ts',
              hash: 'hash1',
            },
          },
        },
      });
    });
  });

  describe('createCache', () => {
    it('should work with empty tsConfig', () => {
      _createCache(createBuildscaleJson({}), createPackageJsonDeps({}), {} as any, {});
    });

    it('should work with no tsconfig', () => {
      const result = _createCache(
        createBuildscaleJson({}),
        createPackageJsonDeps({}),
        {} as any,
        undefined
      );

      expect(result).toBeDefined();
    });
  });

  function createCache(p: Partial<FileMapCache>): FileMapCache {
    const defaults: FileMapCache = {
      version: '6.0',
      buildscaleVersion: buildscaleVersion,
      deps: {},
      pathMappings: {
        mylib: ['libs/mylib/index.ts'],
      },
      buildscaleJsonPlugins: [{ name: 'plugin', version: '1.0.0' }],
      fileMap: {
        nonProjectFiles: [],
        projectFileMap: {
          mylib: [],
        },
      },
    };
    return { ...defaults, ...p };
  }

  function createPackageJsonDeps(
    p: Record<string, string>
  ): Record<string, string> {
    const defaults = {
      '@buildscale/workspace': '12.0.0',
      plugin: '1.0.0',
    };
    return { ...defaults, ...p };
  }

  function createProjectsConfiguration(
    p: any
  ): Record<string, ProjectConfiguration> {
    return { mylib: {}, ...p };
  }

  function createBuildscaleJson(p: Partial<BuildscaleJsonConfiguration>): BuildscaleJsonConfiguration {
    const defaults: BuildscaleJsonConfiguration = {
      workspaceLayout: {} as any,
      plugins: ['plugin'],
    };
    return { ...defaults, ...p };
  }

  function createTsConfigJson(paths?: { [k: string]: any }): any {
    const r = {
      compilerOptions: {
        paths: {
          mylib: ['libs/mylib/index.ts'],
        },
      },
    } as any;
    if (paths) {
      r.compilerOptions.paths = paths;
    }
    return r;
  }
});
