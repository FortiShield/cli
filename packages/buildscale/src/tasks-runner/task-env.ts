import { Task } from '../config/task-graph';
import { config as loadDotEnvFile } from 'dotenv';
import { expand } from 'dotenv-expand';
import { workspaceRoot } from '../utils/workspace-root';

export function getEnvVariablesForBatchProcess(
  skipBuildscaleCache: boolean,
  captureStderr: boolean
): NodeJS.ProcessEnv {
  return {
    // User Process Env Variables override Dotenv Variables
    ...process.env,
    // Buildscale Env Variables overrides everything
    ...getBuildscaleEnvVariablesForForkedProcess(
      process.env.FORCE_COLOR === undefined ? 'true' : process.env.FORCE_COLOR,
      skipBuildscaleCache,
      captureStderr
    ),
  };
}

export function getTaskSpecificEnv(task: Task) {
  // Unload any dot env files at the root of the workspace that were loaded on init of Buildscale.
  const taskEnv = unloadDotEnvFiles({ ...process.env });
  return process.env.BUILDSCALE_LOAD_DOT_ENV_FILES === 'true'
    ? loadDotEnvFilesForTask(task, taskEnv)
    : // If not loading dot env files, ensure env vars created by system are still loaded
      taskEnv;
}

export function getEnvVariablesForTask(
  task: Task,
  taskSpecificEnv: NodeJS.ProcessEnv,
  forceColor: string,
  skipBuildscaleCache: boolean,
  captureStderr: boolean,
  outputPath: string,
  streamOutput: boolean
) {
  const res = {
    // Start With Dotenv Variables
    ...taskSpecificEnv,
    // Buildscale Env Variables overrides everything
    ...getBuildscaleEnvVariablesForTask(
      task,
      forceColor,
      skipBuildscaleCache,
      captureStderr,
      outputPath,
      streamOutput
    ),
  };

  // we have to delete it because if we invoke Buildscale from within Buildscale. we need to reset those values
  if (!outputPath) {
    delete res.BUILDSCALE_TERMINAL_OUTPUT_PATH;
    delete res.BUILDSCALE_STREAM_OUTPUT;
    delete res.BUILDSCALE_PREFIX_OUTPUT;
  }
  // we don't reset BUILDSCALE_BASE or BUILDSCALE_HEAD because those are set by the user and should be preserved
  delete res.BUILDSCALE_SET_CLI;
  return res;
}

function getBuildscaleEnvVariablesForForkedProcess(
  forceColor: string,
  skipBuildscaleCache: boolean,
  captureStderr: boolean,
  outputPath?: string,
  streamOutput?: boolean
) {
  const env: NodeJS.ProcessEnv = {
    FORCE_COLOR: forceColor,
    BUILDSCALE_WORKSPACE_ROOT: workspaceRoot,
    BUILDSCALE_SKIP_BUILDSCALE_CACHE: skipBuildscaleCache ? 'true' : undefined,
  };

  if (outputPath) {
    env.BUILDSCALE_TERMINAL_OUTPUT_PATH = outputPath;
    if (captureStderr) {
      env.BUILDSCALE_TERMINAL_CAPTURE_STDERR = 'true';
    }
    if (streamOutput) {
      env.BUILDSCALE_STREAM_OUTPUT = 'true';
    }
  }
  return env;
}

function getBuildscaleEnvVariablesForTask(
  task: Task,
  forceColor: string,
  skipBuildscaleCache: boolean,
  captureStderr: boolean,
  outputPath: string,
  streamOutput: boolean
) {
  const env: NodeJS.ProcessEnv = {
    BUILDSCALE_TASK_TARGET_PROJECT: task.target.project,
    BUILDSCALE_TASK_TARGET_TARGET: task.target.target,
    BUILDSCALE_TASK_TARGET_CONFIGURATION: task.target.configuration ?? undefined,
    BUILDSCALE_TASK_HASH: task.hash,
    // used when Buildscale is invoked via Lerna
    LERNA_PACKAGE_NAME: task.target.project,
  };

  // TODO: remove this once we have a reasonable way to configure it
  if (task.target.target === 'test') {
    env.BUILDSCALE_TERMINAL_CAPTURE_STDERR = 'true';
  }

  return {
    ...getBuildscaleEnvVariablesForForkedProcess(
      forceColor,
      skipBuildscaleCache,
      captureStderr,
      outputPath,
      streamOutput
    ),
    ...env,
  };
}

function loadDotEnvFilesForTask(
  task: Task,
  environmentVariables: NodeJS.ProcessEnv
) {
  // Collect dot env files that may pertain to a task
  const dotEnvFiles = [
    // Load DotEnv Files for a configuration in the project root
    ...(task.target.configuration
      ? [
          `${task.projectRoot}/.env.${task.target.target}.${task.target.configuration}`,
          `${task.projectRoot}/.env.${task.target.configuration}`,
          `${task.projectRoot}/.${task.target.target}.${task.target.configuration}.env`,
          `${task.projectRoot}/.${task.target.configuration}.env`,
        ]
      : []),

    // Load DotEnv Files for a target in the project root
    `${task.projectRoot}/.env.${task.target.target}`,
    `${task.projectRoot}/.${task.target.target}.env`,
    `${task.projectRoot}/.env.local`,
    `${task.projectRoot}/.local.env`,
    `${task.projectRoot}/.env`,

    // Load DotEnv Files for a configuration in the workspace root
    ...(task.target.configuration
      ? [
          `.env.${task.target.target}.${task.target.configuration}`,
          `.env.${task.target.configuration}`,
          `.${task.target.target}.${task.target.configuration}.env`,
          `.${task.target.configuration}.env`,
        ]
      : []),

    // Load DotEnv Files for a target in the workspace root
    `.env.${task.target.target}`,
    `.${task.target.target}.env`,

    // Load base DotEnv Files at workspace root
    `.local.env`,
    `.env.local`,
    `.env`,
  ];

  for (const file of dotEnvFiles) {
    const myEnv = loadDotEnvFile({
      path: file,
      processEnv: environmentVariables,
      // Do not override existing env variables as we load
      override: false,
    });
    environmentVariables = {
      ...expand({
        ...myEnv,
        ignoreProcessEnv: true, // Do not override existing env variables as we load
      }).parsed,
      ...environmentVariables,
    };
  }

  return environmentVariables;
}

function unloadDotEnvFiles(environmentVariables: NodeJS.ProcessEnv) {
  const unloadDotEnvFile = (filename: string) => {
    let parsedDotEnvFile: NodeJS.ProcessEnv = {};
    loadDotEnvFile({ path: filename, processEnv: parsedDotEnvFile });
    Object.keys(parsedDotEnvFile).forEach((envVarKey) => {
      if (environmentVariables[envVarKey] === parsedDotEnvFile[envVarKey]) {
        delete environmentVariables[envVarKey];
      }
    });
  };

  for (const file of ['.env', '.local.env', '.env.local']) {
    unloadDotEnvFile(file);
  }
  return environmentVariables;
}
