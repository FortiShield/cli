import { BuildscaleJsonConfiguration, readBuildscaleJson } from '../config/buildscale-json';

export function isBuildscaleCloudUsed(buildscaleJson: BuildscaleJsonConfiguration) {
  return (
    process.env.BUILDSCALE_CLOUD_ACCESS_TOKEN ||
    !!buildscaleJson.buildscaleCloudAccessToken ||
    !!Object.values(buildscaleJson.tasksRunnerOptions ?? {}).find(
      (r) => r.runner == '@nrwl/buildscale-cloud' || r.runner == 'buildscale-cloud'
    )
  );
}

export function getBuildscaleCloudUrl(buildscaleJson: BuildscaleJsonConfiguration): string {
  const cloudRunner = Object.values(buildscaleJson.tasksRunnerOptions ?? {}).find(
    (r) => r.runner == '@nrwl/buildscale-cloud' || r.runner == 'buildscale-cloud'
  );
  if (
    !cloudRunner &&
    !(buildscaleJson.buildscaleCloudAccessToken || process.env.BUILDSCALE_CLOUD_ACCESS_TOKEN)
  )
    throw new Error('buildscale-cloud runner not found in buildscale.json');
  return cloudRunner?.options?.url ?? buildscaleJson.buildscaleCloudUrl ?? 'https://buildscale.app';
}

export function getBuildscaleCloudToken(buildscaleJson: BuildscaleJsonConfiguration): string {
  const cloudRunner = Object.values(buildscaleJson.tasksRunnerOptions ?? {}).find(
    (r) => r.runner == '@nrwl/buildscale-cloud' || r.runner == 'buildscale-cloud'
  );

  if (
    !cloudRunner &&
    !(buildscaleJson.buildscaleCloudAccessToken || process.env.BUILDSCALE_CLOUD_ACCESS_TOKEN)
  )
    throw new Error('buildscale-cloud runner not found in buildscale.json');

  return (
    process.env.BUILDSCALE_CLOUD_ACCESS_TOKEN ??
    cloudRunner?.options.accessToken ??
    buildscaleJson.buildscaleCloudAccessToken
  );
}
