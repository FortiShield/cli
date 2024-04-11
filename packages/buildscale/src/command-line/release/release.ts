import { prompt } from 'enquirer';
import { readBuildscaleJson } from '../../config/buildscale-json';
import { createProjectFileMapUsingProjectGraph } from '../../project-graph/file-map-utils';
import { createProjectGraphAsync } from '../../project-graph/project-graph';
import { output } from '../../utils/output';
import { handleErrors } from '../../utils/params';
import { releaseChangelog, shouldCreateGitHubRelease } from './changelog';
import { ReleaseOptions, VersionOptions } from './command-object';
import {
  createBuildscaleReleaseConfig,
  handleBuildscaleReleaseConfigError,
} from './config/config';
import { filterReleaseGroups } from './config/filter-release-groups';
import { releasePublish } from './publish';
import { getCommitHash, gitCommit, gitPush, gitTag } from './utils/git';
import { createOrUpdateGithubRelease } from './utils/github';
import { resolveBuildscaleJsonConfigErrorMessage } from './utils/resolve-buildscale-json-error-message';
import {
  createCommitMessageValues,
  createGitTagValues,
  handleDuplicateGitTags,
} from './utils/shared';
import { BuildscaleReleaseVersionResult, releaseVersion } from './version';

export const releaseCLIHandler = (args: VersionOptions) =>
  handleErrors(args.verbose, () => release(args));

export async function release(
  args: ReleaseOptions
): Promise<BuildscaleReleaseVersionResult | number> {
  const projectGraph = await createProjectGraphAsync({ exitOnError: true });
  const buildscaleJson = readBuildscaleJson();

  if (args.verbose) {
    process.env.BUILDSCALE_VERBOSE_LOGGING = 'true';
  }

  const hasVersionGitConfig =
    Object.keys(buildscaleJson.release?.version?.git ?? {}).length > 0;
  const hasChangelogGitConfig =
    Object.keys(buildscaleJson.release?.changelog?.git ?? {}).length > 0;
  if (hasVersionGitConfig || hasChangelogGitConfig) {
    const jsonConfigErrorPath = hasVersionGitConfig
      ? ['release', 'version', 'git']
      : ['release', 'changelog', 'git'];
    const buildscaleJsonMessage = await resolveBuildscaleJsonConfigErrorMessage(
      jsonConfigErrorPath
    );
    output.error({
      title: `The "release" top level command cannot be used with granular git configuration. Instead, configure git options in the "release.git" property in buildscale.json, or use the version, changelog, and publish subcommands or programmatic API directly.`,
      bodyLines: [buildscaleJsonMessage],
    });
    process.exit(1);
  }

  // Apply default configuration to any optional user configuration
  const { error: configError, buildscaleReleaseConfig } = await createBuildscaleReleaseConfig(
    projectGraph,
    await createProjectFileMapUsingProjectGraph(projectGraph),
    buildscaleJson.release
  );
  if (configError) {
    return await handleBuildscaleReleaseConfigError(configError);
  }

  // These properties must never be undefined as this command should
  // always explicitly override the git operations of the subcommands.
  const shouldCommit = buildscaleJson.release?.git?.commit ?? true;
  const shouldStage =
    (shouldCommit || buildscaleJson.release?.git?.stageChanges) ?? false;
  const shouldTag = buildscaleJson.release?.git?.tag ?? true;

  const versionResult: BuildscaleReleaseVersionResult = await releaseVersion({
    ...args,
    stageChanges: shouldStage,
    gitCommit: false,
    gitTag: false,
  });

  const changelogResult = await releaseChangelog({
    ...args,
    versionData: versionResult.projectsVersionData,
    version: versionResult.workspaceVersion,
    stageChanges: shouldStage,
    gitCommit: false,
    gitTag: false,
    createRelease: false,
  });

  const {
    error: filterError,
    releaseGroups,
    releaseGroupToFilteredProjects,
  } = filterReleaseGroups(
    projectGraph,
    buildscaleReleaseConfig,
    args.projects,
    args.groups
  );
  if (filterError) {
    output.error(filterError);
    process.exit(1);
  }

  if (shouldCommit) {
    output.logSingleLine(`Committing changes with git`);

    const commitMessage: string | undefined = buildscaleReleaseConfig.git.commitMessage;

    const commitMessageValues: string[] = createCommitMessageValues(
      releaseGroups,
      releaseGroupToFilteredProjects,
      versionResult.projectsVersionData,
      commitMessage
    );

    await gitCommit({
      messages: commitMessageValues,
      additionalArgs: buildscaleReleaseConfig.git.commitArgs,
      dryRun: args.dryRun,
      verbose: args.verbose,
    });
  }

  if (shouldTag) {
    output.logSingleLine(`Tagging commit with git`);

    // Resolve any git tags as early as possible so that we can hard error in case of any duplicates before reaching the actual git command
    const gitTagValues: string[] = createGitTagValues(
      releaseGroups,
      releaseGroupToFilteredProjects,
      versionResult.projectsVersionData
    );
    handleDuplicateGitTags(gitTagValues);

    for (const tag of gitTagValues) {
      await gitTag({
        tag,
        message: buildscaleReleaseConfig.git.tagMessage,
        additionalArgs: buildscaleReleaseConfig.git.tagArgs,
        dryRun: args.dryRun,
        verbose: args.verbose,
      });
    }
  }

  const shouldCreateWorkspaceRelease = shouldCreateGitHubRelease(
    buildscaleReleaseConfig.changelog.workspaceChangelog
  );

  let hasPushedChanges = false;
  let latestCommit: string | undefined;

  if (shouldCreateWorkspaceRelease && changelogResult.workspaceChangelog) {
    output.logSingleLine(`Pushing to git remote`);

    // Before we can create/update the release we need to ensure the commit exists on the remote
    await gitPush({
      dryRun: args.dryRun,
      verbose: args.verbose,
    });

    hasPushedChanges = true;

    output.logSingleLine(`Creating GitHub Release`);

    latestCommit = await getCommitHash('HEAD');
    await createOrUpdateGithubRelease(
      changelogResult.workspaceChangelog.releaseVersion,
      changelogResult.workspaceChangelog.contents,
      latestCommit,
      { dryRun: args.dryRun }
    );
  }

  for (const releaseGroup of releaseGroups) {
    const shouldCreateProjectReleases = shouldCreateGitHubRelease(
      releaseGroup.changelog
    );

    if (shouldCreateProjectReleases && changelogResult.projectChangelogs) {
      const projects = args.projects?.length
        ? // If the user has passed a list of projects, we need to use the filtered list of projects within the release group
          Array.from(releaseGroupToFilteredProjects.get(releaseGroup))
        : // Otherwise, we use the full list of projects within the release group
          releaseGroup.projects;
      const projectNodes = projects.map((name) => projectGraph.nodes[name]);

      for (const project of projectNodes) {
        const changelog = changelogResult.projectChangelogs[project.name];
        if (!changelog) {
          continue;
        }

        if (!hasPushedChanges) {
          output.logSingleLine(`Pushing to git remote`);

          // Before we can create/update the release we need to ensure the commit exists on the remote
          await gitPush({
            dryRun: args.dryRun,
            verbose: args.verbose,
          });

          hasPushedChanges = true;
        }

        output.logSingleLine(`Creating GitHub Release`);

        if (!latestCommit) {
          latestCommit = await getCommitHash('HEAD');
        }

        await createOrUpdateGithubRelease(
          changelog.releaseVersion,
          changelog.contents,
          latestCommit,
          { dryRun: args.dryRun }
        );
      }
    }
  }

  let hasNewVersion = false;
  // null means that all projects are versioned together but there were no changes
  if (versionResult.workspaceVersion !== null) {
    hasNewVersion = Object.values(versionResult.projectsVersionData).some(
      (version) => version.newVersion !== null
    );
  }

  let shouldPublish = !!args.yes && !args.skipPublish && hasNewVersion;
  const shouldPromptPublishing =
    !args.yes && !args.skipPublish && !args.dryRun && hasNewVersion;

  if (shouldPromptPublishing) {
    shouldPublish = await promptForPublish();
  }

  if (shouldPublish) {
    await releasePublish(args);
  } else {
    output.logSingleLine('Skipped publishing packages.');
  }

  return versionResult;
}

async function promptForPublish(): Promise<boolean> {
  try {
    const reply = await prompt<{ confirmation: boolean }>([
      {
        name: 'confirmation',
        message: 'Do you want to publish these versions?',
        type: 'confirm',
      },
    ]);
    return reply.confirmation;
  } catch (e) {
    // Handle the case where the user exits the prompt with ctrl+c
    return false;
  }
}
