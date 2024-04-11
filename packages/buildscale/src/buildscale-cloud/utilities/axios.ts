import { AxiosRequestConfig } from 'axios';
import { join } from 'path';
import {
  ACCESS_TOKEN,
  BUILDSCALE_CLOUD_NO_TIMEOUTS,
  UNLIMITED_TIMEOUT,
} from './environment';
import { CloudTaskRunnerOptions } from '../buildscale-cloud-tasks-runner-shell';

const axios = require('axios');

export function createApiAxiosInstance(options: CloudTaskRunnerOptions) {
  let axiosConfigBuilder = (axiosConfig: AxiosRequestConfig) => axiosConfig;
  const baseUrl =
    process.env.BUILDSCALE_CLOUD_API || options.url || 'https://cloud.buildscalew.app';
  const accessToken = ACCESS_TOKEN ? ACCESS_TOKEN : options.accessToken!;

  if (!accessToken) {
    throw new Error(
      `Unable to authenticate. Either define accessToken in buildscale.json or set the BUILDSCALE_CLOUD_ACCESS_TOKEN env variable.`
    );
  }

  if (options.customProxyConfigPath) {
    const { buildscaleCloudProxyConfig } = require(join(
      process.cwd(),
      options.customProxyConfigPath
    ));
    axiosConfigBuilder = buildscaleCloudProxyConfig ?? axiosConfigBuilder;
  }

  return axios.create(
    axiosConfigBuilder({
      baseURL: baseUrl,
      timeout: BUILDSCALE_CLOUD_NO_TIMEOUTS ? UNLIMITED_TIMEOUT : 10000,
      headers: { authorization: accessToken },
    })
  );
}
