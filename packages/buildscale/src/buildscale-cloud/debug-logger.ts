export function debugLog(...args: any[]) {
  if (process.env['BUILDSCALE_VERBOSE_LOGGING'] === 'true') {
    console.log('[BUILDSCALE CLOUD]', ...args);
  }
}
