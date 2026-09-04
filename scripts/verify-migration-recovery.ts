import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  type MigrationJournalEntry,
  type MigrationRecoveryManifest,
  verifyMigrationRecoveryGovernance,
} from '../src/infrastructure/database/migration-recovery.js';

const journalPath = resolve('src/infrastructure/database/migrations/meta/_journal.json');
const manifestPath = resolve('src/infrastructure/database/migrations/meta/recovery-manifest.json');

const journal = JSON.parse(await readFile(journalPath, 'utf8')) as { entries?: MigrationJournalEntry[] };
const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as MigrationRecoveryManifest;
const verification = verifyMigrationRecoveryGovernance(journal, manifest);

if (verification.errors.length > 0) {
  console.error('Migration recovery governance verification failed:');
  for (const error of verification.errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `Migration recovery governance verified for ${verification.migrationCount} migrations` +
      ` (${verification.automatedRecoveryTestCount} automated recovery test reference(s)).`,
  );
}
