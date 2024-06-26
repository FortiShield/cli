import json = require('./migrations.json');

import { assertValidMigrationPaths } from './src/internal-testing-utils/assert-valid-migrations';
import { MigrationsJson } from './src/config/misc-interfaces';

describe('buildscale migrations', () => {
  assertValidMigrationPaths(json as MigrationsJson, __dirname);
});
