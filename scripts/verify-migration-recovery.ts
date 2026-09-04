import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

interface JournalEntry {
  tag: string;
}

interface RecoveryEntry {
  strategy: string;
  destructiveDownAllowed: boolean;
  note: string;
}

interface RecoveryManifest {
  version: number;
  migrations: Record<string, RecoveryEntry>;
}

const journalPath = resolve('src/infrastructure/database/migrations/meta/_journal.json');
const manifestPath = resolve('src/infrastructure/database/migrations/meta/recovery-manifest.json');

const journal = JSON.parse(await readFile(journalPath, 'utf8')) as { entries?: JournalEntry[] };
const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as RecoveryManifest;

const errors: string[] = [];
const tags = (journal.entries ?? []).map((entry) => entry.tag);

for (const tag of tags) {
  const recovery = manifest.migrations[tag];
  if (!recovery) {
    errors.push(`${tag}: missing recovery-manifest entry`);
    continue;
  }
  if (!recovery.strategy.trim()) errors.push(`${tag}: recovery strategy is empty`);
  if (!recovery.note.trim()) errors.push(`${tag}: recovery note is empty`);
  if (typeof recovery.destructiveDownAllowed !== 'boolean') {
    errors.push(`${tag}: destructiveDownAllowed must be boolean`);
  }
}

for (const tag of Object.keys(manifest.migrations)) {
  if (!tags.includes(tag)) {
    errors.push(`${tag}: recovery entry has no matching migration journal entry`);
  }
}

if (errors.length > 0) {
  console.error('Migration recovery governance verification failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Migration recovery governance verified for ${tags.length} migrations.`);
}
