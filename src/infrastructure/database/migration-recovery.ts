export const recoveryStrategies = [
  'restore-backup',
  'compensating-migration',
  'forward-only-security',
  'automated-down',
] as const;

export type RecoveryStrategy = (typeof recoveryStrategies)[number];

export interface MigrationJournalEntry {
  tag: string;
}

export interface MigrationRecoveryEntry {
  strategy: RecoveryStrategy;
  destructiveDownAllowed: boolean;
  note: string;
  automatedRecoveryTest?: string;
}

export interface MigrationRecoveryManifest {
  version: number;
  migrations: Record<string, MigrationRecoveryEntry>;
}

export interface MigrationRecoveryVerification {
  migrationCount: number;
  automatedRecoveryTestCount: number;
  errors: string[];
}

export function verifyMigrationRecoveryGovernance(
  journal: { entries?: MigrationJournalEntry[] },
  manifest: MigrationRecoveryManifest,
): MigrationRecoveryVerification {
  const errors: string[] = [];
  const tags = (journal.entries ?? []).map((entry) => entry.tag);
  const tagSet = new Set(tags);
  let automatedRecoveryTestCount = 0;

  if (!Number.isInteger(manifest.version) || manifest.version < 1) {
    errors.push('manifest: version must be a positive integer');
  }

  if (tagSet.size !== tags.length) {
    errors.push('journal: duplicate migration tags are not allowed');
  }

  for (const tag of tags) {
    const recovery = manifest.migrations[tag];
    if (!recovery) {
      errors.push(`${tag}: missing recovery-manifest entry`);
      continue;
    }

    if (!recoveryStrategies.includes(recovery.strategy)) {
      errors.push(`${tag}: unsupported recovery strategy ${String(recovery.strategy)}`);
    }
    if (!recovery.note.trim()) errors.push(`${tag}: recovery note is empty`);
    if (typeof recovery.destructiveDownAllowed !== 'boolean') {
      errors.push(`${tag}: destructiveDownAllowed must be boolean`);
    }

    if (recovery.strategy === 'automated-down') {
      if (!recovery.automatedRecoveryTest?.trim()) {
        errors.push(`${tag}: automated-down strategy requires automatedRecoveryTest`);
      } else {
        automatedRecoveryTestCount += 1;
      }
      if (!recovery.destructiveDownAllowed) {
        errors.push(`${tag}: automated-down requires destructiveDownAllowed=true after explicit review`);
      }
    } else if (recovery.automatedRecoveryTest?.trim()) {
      automatedRecoveryTestCount += 1;
    }

    if (recovery.strategy === 'forward-only-security' && recovery.destructiveDownAllowed) {
      errors.push(`${tag}: forward-only-security migrations cannot allow destructive automated down`);
    }
  }

  for (const tag of Object.keys(manifest.migrations)) {
    if (!tagSet.has(tag)) {
      errors.push(`${tag}: recovery entry has no matching migration journal entry`);
    }
  }

  return {
    migrationCount: tags.length,
    automatedRecoveryTestCount,
    errors,
  };
}
