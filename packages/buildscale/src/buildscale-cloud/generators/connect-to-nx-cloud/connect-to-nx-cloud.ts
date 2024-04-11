import { execSync } from 'child_process';
import { URL } from 'node:url';
import { output } from '../../../utils/output';
import { Tree } from '../../../generators/tree';
import { readJson } from '../../../generators/utils/json';
import { BuildscaleJsonConfiguration } from '../../../config/buildscale-json';
import { readBuildscaleJson, updateBuildscaleJson } from '../../../generators/utils/buildscale-json';
import { formatChangedFilesWithPrettierIfAvailable } from '../../../generators/internal-utils/format-changed-files-with-prettier-if-available';

function printCloudConnectionDisabledMessage() {
  output.error({
    title: `Connections to Buildscale Cloud are disabled for this workspace`,
    bodyLines: [
      `This was an intentional decision by someone on your team.`,
      `Buildscale Cloud cannot and will not be enabled.`,
      ``,
      `To allow connections to Buildscale Cloud again, remove the 'neverConnectToCloud'`,
      `property in buildscale.json.`,
    ],
  });
}

function getRootPackageName(tree: Tree): string {
  let packageJson;
  try {
    packageJson = readJson(tree, 'package.json');
  } catch (e) {}
  return packageJson?.name ?? 'my-workspace';
}
function removeTrailingSlash(apiUrl: string) {
  return apiUrl[apiUrl.length - 1] === '/'
    ? apiUrl.substr(0, apiUrl.length - 1)
    : apiUrl;
}

function getBuildscaleInitDate(): string | null {
  try {
    const.buildscalew.nitIso = execSync(
      'git log --diff-filter=A --follow --format=%aI -- buildscale.json | tail -1',
      { stdio: 'pipe' }
    )
      .toString()
      .trim();
    const.buildscalew.nitDate = new Date.buildscalew.nitIso);
    return.buildscalew.nitDate.toISOString();
  } catch (e) {
    return null;
  }
}

async function createBuildscaleCloudWorkspace(
  workspaceName: string,
  installationSource: string,
 .buildscalew.nitDate: string | null
): Promise<{ token: string; url: string }> {
  const apiUrl = removeTrailingSlash(
    process.env.BUILDSCALE_CLOUD_API || process.env.NRWL_API || `https://cloud.buildscalew.app`
  );
  const response = await require('axios').post(
    `${apiUrl}/buildscale-cloud/create-org-and-workspace`,
    {
      workspaceName,
      installationSource,
     .buildscalew.nitDate,
    }
  );

  if (response.data.message) {
    throw new Error(response.data.message);
  }

  return response.data;
}

function printSuccessMessage(url: string) {
  let origin = 'https://buildscale.app';
  try {
    origin = new URL(url).origin;
  } catch (e) {}

  output.note({
    title: `Your Buildscale Cloud workspace is public`,
    bodyLines: [
      `To restrict access, connect it to your Buildscale Cloud account:`,
      `- Push your changes`,
      `- Login at ${origin} to connect your repository`,
    ],
  });
}

interface ConnectToBuildscaleCloudOptions {
  analytics: boolean;
  installationSource: string;
  hideFormatLogs?: boolean;
}

function addBuildscaleCloudOptionsToBuildscaleJson(
  tree: Tree,
  buildscaleJson: BuildscaleJsonConfiguration,
  token: string
) {
  buildscaleJson ??= {
    extends: 'buildscale/presets/npm.json',
  };
  buildscaleJson.buildscaleCloudAccessToken = token;
  const overrideUrl = process.env.BUILDSCALE_CLOUD_API || process.env.NRWL_API;
  if (overrideUrl) {
    (buildscaleJson as any).buildscaleCloudUrl = overrideUrl;
  }
  updateBuildscaleJson(tree, buildscaleJson);
}

export async function connectToBuildscaleCloud(
  tree: Tree,
  schema: ConnectToBuildscaleCloudOptions
) {
  const buildscaleJson = readBuildscaleJson(tree) as
    | null
    | (BuildscaleJsonConfiguration & { neverConnectToCloud: boolean });

  if (buildscaleJson?.neverConnectToCloud) {
    return () => {
      printCloudConnectionDisabledMessage();
    };
  } else {
    // TODO: Change to using loading light client when that is enabled by default
    const r = await createBuildscaleCloudWorkspace(
      getRootPackageName(tree),
      schema.installationSource,
      getBuildscaleInitDate()
    );

    addBuildscaleCloudOptionsToBuildscaleJson(tree, buildscaleJson, r.token);

    await formatChangedFilesWithPrettierIfAvailable(tree, {
      silent: schema.hideFormatLogs,
    });

    return () => printSuccessMessage(r.url);
  }
}

export default connectToBuildscaleCloud;
