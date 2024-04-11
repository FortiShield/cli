import { toProjectName } from './workspaces';
import { TempFs } from '../internal-testing-utils/temp-fs';
import { withEnvironmentVariables } from '../internal-testing-utils/with-environment';
import { retrieveProjectConfigurations } from '../project-graph/utils/retrieve-workspace-files';
import { readBuildscaleJson } from './configuration';
import { loadBuildscalePlugins } from '../project-graph/plugins/internal-api';

describe('Workspaces', () => {
  let fs: TempFs;
  beforeEach(() => {
    fs = new TempFs('Workspaces');
  });
  afterEach(() => {
    fs.cleanup();
  });

  describe('to project name', () => {
    it('should lowercase names', () => {
      const appResults = toProjectName('my-apps/directory/my-app/package.json');
      const libResults = toProjectName('packages/directory/MyLib/package.json');
      expect(appResults).toEqual('my-app');
      expect(libResults).toEqual('mylib');
    });

    it('should use the workspace globs in package.json', async () => {
      await fs.createFiles({
        'packages/my-package/package.json': JSON.stringify({
          name: 'my-package',
        }),
        'package.json': JSON.stringify({
          name: 'package-name',
          workspaces: ['packages/**'],
        }),
      });

      const { projects } = await withEnvironmentVariables(
        {
          BUILDSCALE_WORKSPACE_ROOT_PATH: fs.tempDir,
        },
        async () => {
          const [plugins, cleanup] = await loadBuildscalePlugins(
            readBuildscaleJson(fs.tempDir).plugins,
            fs.tempDir
          );
          const res = retrieveProjectConfigurations(
            plugins,
            fs.tempDir,
            readBuildscaleJson(fs.tempDir)
          );
          cleanup();
          return res;
        }
      );
      console.log(projects);
      expect(projects['my-package']).toEqual({
        name: 'my-package',
        root: 'packages/my-package',
        sourceRoot: 'packages/my-package',
        projectType: 'library',
        targets: {
          'buildscale-release-publish': {
            dependsOn: ['^buildscale-release-publish'],
            executor: '@buildscale/js:release-publish',
            options: {},
          },
        },
      });
    });
  });
});
