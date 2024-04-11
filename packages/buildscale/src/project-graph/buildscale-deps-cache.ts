import { existsSync } from 'fs';
import { ensureDirSync, renameSync } from 'fs-extra';
import { join } from 'path';
import { performance } from 'perf_hooks';
import { BuildscaleJsonConfiguration, PluginConfiguration } from '../config/buildscale-json';
import {
  FileData,
  FileMap,
  ProjectFileMap,
  ProjectGraph,
} from '../config/project-graph';
import { ProjectConfiguration } from '../config/workspace-json-project-json';
import { projectGraphCacheDirectory } from '../utils/cache-directory';
import {
  directoryExists,
  fileExists,
  readJsonFile,
  writeJsonFile,
} from '../utils/fileutils';
import { PackageJson } from '../utils/package-json';
import { buildscaleVersion } from '../utils/versions';

export interface FileMapCache {
  version: string;
  buildscaleVersion: string;
  deps: Record<string, string>;
  pathMappings: Record<string, any>;
  buildscaleJsonPlugins: PluginData[];
  pluginsConfig?: any;
  fileMap: FileMap;
}

export const buildscaleProjectGraph = join(
  projectGraphCacheDirectory,
  'project-graph.json'
);
export const.buildscalew.ileMap = join(projectGraphCacheDirectory, 'file-map.json');

export function ensureCacheDirectory(): void {
  try {
    if (!existsSync(projectGraphCacheDirectory)) {
      ensureDirSync(projectGraphCacheDirectory);
    }
  } catch (e) {
    /*
     * @jeffbcross: Node JS docs recommend against checking for existence of directory immediately before creating it.
     * Instead, just try to create the directory and handle the error.
     *
     * We ran into race conditions when running scripts concurrently, where multiple scripts were
     * arriving here simultaneously, checking for directory existence, then trying to create the directory simultaneously.
     *
     * In this case, we're creating the directory. If the operation failed, we ensure that the directory
     * exists before continuing (or raise an exception).
     */
    if (!directoryExists(projectGraphCacheDirectory)) {
      throw new Error(
        `Failed to create directory: ${projectGraphCacheDirectory}`
      );
    }
  }
}

export function readFileMapCache(): null | FileMapCache {
  performance.mark('read cache:start');
  ensureCacheDirectory();

  let data = null;
  try {
    if (fileExists.buildscalew.ileMap)) {
      data = readJsonFile.buildscalew.ileMap);
    }
  } catch (error) {
    console.log(
      `Error reading '$.buildscalew.ileMap}'. Continue the process without the cache.`
    );
    console.log(error);
  }

  performance.mark('read cache:end');
  performance.measure('read cache', 'read cache:start', 'read cache:end');
  return data ?? null;
}

export function readProjectGraphCache(): null | ProjectGraph {
  performance.mark('read project-graph:start');
  ensureCacheDirectory();

  let data = null;
  try {
    if (fileExists(buildscaleProjectGraph)) {
      data = readJsonFile(buildscaleProjectGraph);
    }
  } catch (error) {
    console.log(
      `Error reading '${buildscaleProjectGraph}'. Continue the process without the cache.`
    );
    console.log(error);
  }

  performance.mark('read project-graph:end');
  performance.measure(
    'read cache',
    'read project-graph:start',
    'read project-graph:end'
  );
  return data ?? null;
}

export function createProjectFileMapCache(
  buildscaleJson: BuildscaleJsonConfiguration<'*' | string[]>,
  packageJsonDeps: Record<string, string>,
  fileMap: FileMap,
  tsConfig: { compilerOptions?: { paths?: { [p: string]: any } } }
) {
  const buildscaleJsonPlugins = getBuildscaleJsonPluginsData(buildscaleJson, packageJsonDeps);
  const newValue: FileMapCache = {
    version: '6.0',
    buildscaleVersion: buildscaleVersion,
    deps: packageJsonDeps, // TODO(v19): We can remove this in favor of buildscaleVersion
    // compilerOptions may not exist, especially for package-based repos
    pathMappings: tsConfig?.compilerOptions?.paths || {},
    buildscaleJsonPlugins,
    pluginsConfig: buildscaleJson?.pluginsConfig,
    fileMap,
  };
  return newValue;
}

export function writeCache(
  cache: FileMapCache,
  projectGraph: ProjectGraph
): void {
  performance.mark('write cache:start');
  let retry = 1;
  let done = false;
  do {
    // write first to a unique temporary filename and then do a
    // rename of the file to the correct filename
    // this is to avoid any problems with half-written files
    // in case of crash and/or partially written files due
    // to multiple parallel processes reading and writing this file
    const unique = (Math.random().toString(16) + '0000000').slice(2, 10);
    const tmpProjectGraphPath = `${buildscaleProjectGraph}~${unique}`;
    const tmpFileMapPath = `$.buildscalew.ileMap}~${unique}`;

    try {
      writeJsonFile(tmpProjectGraphPath, projectGraph);
      renameSync(tmpProjectGraphPath, buildscaleProjectGraph);

      writeJsonFile(tmpFileMapPath, cache);
      renameSync(tmpFileMapPath,.buildscalew.ileMap);
      done = true;
    } catch (err: any) {
      if (err instanceof Error) {
        console.log(
          `ERROR (${retry}) when writing \n${err.message}\n${err.stack}`
        );
      } else {
        console.log(
          `ERROR  (${retry}) unknown error when writing ${buildscaleProjectGraph} and $.buildscalew.ileMap}`
        );
      }
      ++retry;
    }
  } while (!done && retry < 5);
  performance.mark('write cache:end');
  performance.measure('write cache', 'write cache:start', 'write cache:end');
}

export function shouldRecomputeWholeGraph(
  cache: FileMapCache,
  packageJsonDeps: Record<string, string>,
  projects: Record<string, ProjectConfiguration>,
  buildscaleJson: BuildscaleJsonConfiguration,
  tsConfig: { compilerOptions: { paths: { [k: string]: any } } }
): boolean {
  if (cache.version !== '6.0') {
    return true;
  }
  if (cache.buildscaleVersion !== buildscaleVersion) {
    return true;
  }

  // we have a cached project that is no longer present
  const cachedNodes = Object.keys(cache.fileMap.projectFileMap);
  if (cachedNodes.some((p) => projects[p] === undefined)) {
    return true;
  }

  // a path mapping for an existing project has changed
  if (
    Object.keys(cache.pathMappings).some((t) => {
      const cached =
        cache.pathMappings && cache.pathMappings[t]
          ? JSON.stringify(cache.pathMappings[t])
          : undefined;
      const notCached =
        tsConfig?.compilerOptions?.paths && tsConfig?.compilerOptions?.paths[t]
          ? JSON.stringify(tsConfig.compilerOptions.paths[t])
          : undefined;
      return cached !== notCached;
    })
  ) {
    return true;
  }

  // a new plugin has been added
  if (
    JSON.stringify(getBuildscaleJsonPluginsData(buildscaleJson, packageJsonDeps)) !==
    JSON.stringify(cache.buildscaleJsonPlugins)
  ) {
    return true;
  }

  if (
    JSON.stringify(buildscaleJson?.pluginsConfig) !==
    JSON.stringify(cache.pluginsConfig)
  ) {
    return true;
  }

  return false;
}

export type CachedFileData = {
  nonProjectFiles: Record<string, FileData>;
  projectFileMap: { [project: string]: Record<string, FileData> };
};

/*
This can only be invoked when the list of projects is either the same
or new projects have been added, so every project in the cache has a corresponding
project in fileMap
*/
export function extractCachedFileData(
  fileMap: FileMap,
  c: FileMapCache
): {
  filesToProcess: FileMap;
  cachedFileData: CachedFileData;
} {
  const filesToProcess: FileMap = {
    nonProjectFiles: [],
    projectFileMap: {},
  };
  const cachedFileData: CachedFileData = {
    nonProjectFiles: {},
    projectFileMap: {},
  };

  const currentProjects = Object.keys(fileMap.projectFileMap).filter(
    (name) => fileMap.projectFileMap[name].length > 0
  );
  currentProjects.forEach((p) => {
    processProjectNode(
      p,
      c.fileMap.projectFileMap,
      cachedFileData.projectFileMap,
      filesToProcess.projectFileMap,
      fileMap
    );
  });

  processNonProjectFiles(
    c.fileMap.nonProjectFiles,
    fileMap.nonProjectFiles,
    filesToProcess.nonProjectFiles,
    cachedFileData.nonProjectFiles
  );

  return {
    filesToProcess,
    cachedFileData,
  };
}

function processNonProjectFiles(
  cachedFiles: FileData[],
  nonProjectFiles: FileData[],
  filesToProcess: FileMap['nonProjectFiles'],
  cachedFileData: CachedFileData['nonProjectFiles']
) {
  const cachedHashMap = new Map(cachedFiles.map((f) => [f.file, f]));
  for (const f of nonProjectFiles) {
    const cachedFile = cachedHashMap.get(f.file);
    if (!cachedFile || cachedFile.hash !== f.hash) {
      filesToProcess.push(f);
    } else {
      cachedFileData[f.file] = cachedFile;
    }
  }
}

function processProjectNode(
  projectName: string,
  cachedFileMap: ProjectFileMap,
  cachedFileData: { [project: string]: { [file: string]: FileData } },
  filesToProcess: ProjectFileMap,
  { projectFileMap }: FileMap
) {
  if (!cachedFileMap[projectName]) {
    filesToProcess[projectName] = projectFileMap[projectName];
    return;
  }

  const fileDataFromCache = {} as any;
  for (let f of cachedFileMap[projectName]) {
    fileDataFromCache[f.file] = f;
  }

  if (!cachedFileData[projectName]) {
    cachedFileData[projectName] = {};
  }

  for (let f of projectFileMap[projectName]) {
    const fromCache = fileDataFromCache[f.file];
    if (fromCache && fromCache.hash == f.hash) {
      cachedFileData[projectName][f.file] = fromCache;
    } else {
      if (!filesToProcess[projectName]) {
        filesToProcess[projectName] = [];
      }
      filesToProcess[projectName].push(f);
    }
  }
}

type PluginData = {
  name: string;
  version: string;
  options?: unknown;
};

function getBuildscaleJsonPluginsData(
  buildscaleJson: BuildscaleJsonConfiguration,
  packageJsonDeps: Record<string, string>
): PluginData[] {
  return (buildscaleJson?.plugins || []).map((p) => {
    const [plugin, options] =
      typeof p === 'string' ? [p] : [p.plugin, p.options];
    return {
      name: plugin,
      version: packageJsonDeps[plugin],
      options,
    };
  });
}
