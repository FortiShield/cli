import { commandsObject } from './buildscale-commands';

import * as yargsParser from 'yargs-parser';

describe('buildscale-commands', () => {
  it('should parse dot notion cli args', () => {
    const actual = yargsParser(
      [
        'buildscale',
        'e2e',
        'project-e2e',
        '--env.BUILDSCALE_API_URL=http://localhost:4200',
        '--abc.123.xyx=false',
        '--a.b=3',
      ],
      commandsObject.parserConfiguration
    );

    expect(actual).toEqual(
      expect.objectContaining({
        abc: {
          '123': {
            xyx: 'false',
          },
        },
        a: {
          b: 3,
        },
        env: {
          BUILDSCALE_API_URL: 'http://localhost:4200',
        },
      })
    );
  });
});
