import { serverLogger } from './logger';

describe('serverLogger', () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    jest
      .spyOn(global.Date, 'now')
      .mockImplementation(() => new Date('2021-10-11T17:18:45.980Z').valueOf());
    consoleLogSpy = jest.spyOn(console, 'log');
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('log()', () => {
    const testCases = [
      {
        inputs: ['foobar'],
        expectedLog: '[BUILDSCALE Daemon Server] - 2021-10-11T17:18:45.980Z - foobar',
      },
      {
        inputs: ['foo', 'bar'],
        expectedLog: '[BUILDSCALE Daemon Server] - 2021-10-11T17:18:45.980Z - foo bar',
      },
      {
        inputs: [1, 2],
        expectedLog: '[BUILDSCALE Daemon Server] - 2021-10-11T17:18:45.980Z - 1 2',
      },
      {
        inputs: [{ some: 'object' }, ['an', 'array']],
        expectedLog:
          '[BUILDSCALE Daemon Server] - 2021-10-11T17:18:45.980Z - {"some":"object"} ["an","array"]',
      },
    ];

    testCases.forEach((tc, i) => {
      it('should pretty print the given message(s) to stdout, wrapping them with useful metadata, CASE: ${i + 1}', () => {
        serverLogger.log(...tc.inputs);
        expect(consoleLogSpy).toHaveBeenCalledWith(tc.expectedLog);
      });
    });
  });

  describe('requestLog() watcherLog() and nestedLog()', () => {
    it('should pretty print the various server log styles', () => {
      serverLogger.log('Server started');
      serverLogger.watcherLog('Watching started');
      serverLogger.requestLog('A request has come in');
      serverLogger.watcherLog('Watching stopped');
      serverLogger.log('Server stopped');
      // prettier-ignore
      expect(consoleLogSpy.mock.calls).toEqual([
        ['[BUILDSCALE Daemon Server] - 2021-10-11T17:18:45.980Z - Server started'],
        ['[BUILDSCALE Daemon Server] - 2021-10-11T17:18:45.980Z - [WATCHER]: Watching started'],
        ['[BUILDSCALE Daemon Server] - 2021-10-11T17:18:45.980Z - [REQUEST]: A request has come in'],
        ['[BUILDSCALE Daemon Server] - 2021-10-11T17:18:45.980Z - [WATCHER]: Watching stopped'],
        ['[BUILDSCALE Daemon Server] - 2021-10-11T17:18:45.980Z - Server stopped'],
      ]);
    });
  });
});
