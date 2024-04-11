import { readJsonFile, writeJsonFile } from '../../../../utils/fileutils';

export function addViteCommandsToPackageScripts(
  appName: string,
  isStandalone: boolean
) {
  const packageJsonPath = isStandalone
    ? 'package.json'
    : `apps/${appName}/package.json`;
  const packageJson = readJsonFile(packageJsonPath);
  packageJson.scripts = {
    ...packageJson.scripts,
    start: 'buildscale exec -- vite',
    serve: 'buildscale exec -- vite',
    build: `buildscale exec -- vite build`,
    test: 'buildscale exec -- vitest',
  };
  writeJsonFile(packageJsonPath, packageJson, { spaces: 2 });
}
