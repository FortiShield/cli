import { TempFs } from '../../internal-testing-utils/temp-fs';
import { retrieveProjectConfigurationPaths } from './retrieve-workspace-files';

describe('retrieveProjectConfigurationPaths', () => {
  let fs: TempFs;
  beforeAll(() => {
    fs = new TempFs('retrieveProjectConfigurationPaths');
  });
  afterAll(() => {
    fs.cleanup();
  });

  it('should not find files that are listed by .buildscaleignore', async () => {
    await fs.createFile('.buildscaleignore', `not-projects`);
    await fs.createFile(
      'not-projects/project.json',
      JSON.stringify({
        name: 'not-project-1',
      })
    );
    await fs.createFile(
      'projects/project.json',
      JSON.stringify({
        name: 'project-1',
      })
    );

    const configPaths = retrieveProjectConfigurationPaths(fs.tempDir, [
      {
        createNodes: [
          '{project.json,**/project.json}',
          () => {
            return {
              projects: {},
            };
          },
        ],
      },
    ]);

    expect(configPaths).not.toContain('not-projects/project.json');
    expect(configPaths).toContain('projects/project.json');
  });
});
