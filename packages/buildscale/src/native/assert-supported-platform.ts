import { output } from '../utils/output';

export function assertSupportedPlatform() {
  try {
    require('./index.js');
  } catch (e) {
    let title = '';
    let bodyLines = [];
    if (
      process.platform == 'win32' ||
      process.platform == 'darwin' ||
      process.platform == 'linux' ||
      process.platform == 'freebsd'
    ) {
      title = 'Missing Platform Dependency';
      bodyLines = [
        `The Buildscale CLI could not find or load the native binary for your supported platform (${process.platform}-${process.arch}).`,
        'This likely means that optional dependencies were not installed correctly, or your system is missing some system dependencies.',
      ];
      if (process.env.BUILDSCALE_VERBOSE_LOGGING == 'true') {
        bodyLines.push('', 'Additional error information:', e.message);
      }
    } else {
      title = 'Platform not supported';
      bodyLines = [
        `This platform (${process.platform}-${process.arch}) is currently not supported by Buildscale.`,
      ];
    }

    bodyLines.push(
      'For more information please see https://buildscale.github.io/troubleshooting/troubleshoot-buildscale-install-issues'
    );

    output.error({
      title,
      bodyLines,
    });
    process.exit(1);
  }
}
