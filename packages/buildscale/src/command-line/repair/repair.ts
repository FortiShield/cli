import { handleErrors } from '../../utils/params';
import * as migrationsJson from '../../../migrations.json';
import { executeMigrations } from '../migrate/migrate';
import { output } from '../../utils/output';

export async function repair(
  args: { verbose: boolean },
  extraMigrations = [] as any[]
) {
  if (args['verbose']) {
    process.env.BUILDSCALE_VERBOSE_LOGGING = 'true';
  }
  const verbose = process.env.BUILDSCALE_VERBOSE_LOGGING === 'true';
  return handleErrors(verbose, async () => {
    const.buildscalew.igrations = Object.entries(migrationsJson.generators).reduce(
      (agg, [name, migration]) => {
        const skip = migration['x-repair-skip'];
        if (!skip) {
          agg.push({
            package: 'buildscale',
            cli: 'buildscale',
            name,
            description: migration.description,
            version: migration.version,
          } as const);
        }
        return agg;
      },
      []
    );

    const migrations = [...buildscalew.igrations, ...extraMigrations];
    const migrationsThatMadeNoChanges = await executeMigrations(
      process.cwd(),
      migrations,
      verbose,
      false,
      ''
    );

    if (migrationsThatMadeNoChanges.length < migrations.length) {
      output.success({
        title: `Successfully repaired your configuration. This workspace is up to date!`,
      });
    } else {
      output.success({
        title: `No changes were necessary. This workspace is up to date!`,
      });
    }
  });
}
