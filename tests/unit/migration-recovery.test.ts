import { describe, expect, it } from 'vitest';

import {
  type MigrationRecoveryManifest,
  verifyMigrationRecoveryGovernance,
} from '../../src/infrastructure/database/migration-recovery.js';

const manifestFor = (
  migrations: MigrationRecoveryManifest['migrations'],
): MigrationRecoveryManifest => ({ version: 1, migrations });

describe('migration recovery governance', () => {
  it('accepts reviewed forward-only and compensating strategies', () => {
    const result = verifyMigrationRecoveryGovernance(
      { entries: [{ tag: '0001-safe' }, { tag: '0002-security' }] },
      manifestFor({
        '0001-safe': {
          strategy: 'compensating-migration',
          destructiveDownAllowed: false,
          note: 'Correct forward while preserving data.',
        },
        '0002-security': {
          strategy: 'forward-only-security',
          destructiveDownAllowed: false,
          note: 'Security evidence is never rolled back destructively.',
        },
      }),
    );

    expect(result.errors).toEqual([]);
    expect(result.migrationCount).toBe(2);
  });

  it('requires an explicit automated recovery test for automated-down', () => {
    const result = verifyMigrationRecoveryGovernance(
      { entries: [{ tag: '0001-reversible' }] },
      manifestFor({
        '0001-reversible': {
          strategy: 'automated-down',
          destructiveDownAllowed: true,
          note: 'Reviewed as reversible.',
        },
      }),
    );

    expect(result.errors).toContain('0001-reversible: automated-down strategy requires automatedRecoveryTest');
  });

  it('rejects destructive rollback for forward-only security migrations', () => {
    const result = verifyMigrationRecoveryGovernance(
      { entries: [{ tag: '0001-security' }] },
      manifestFor({
        '0001-security': {
          strategy: 'forward-only-security',
          destructiveDownAllowed: true,
          note: 'Invalid on purpose.',
        },
      }),
    );

    expect(result.errors).toContain(
      '0001-security: forward-only-security migrations cannot allow destructive automated down',
    );
  });

  it('rejects journal/manifest drift', () => {
    const result = verifyMigrationRecoveryGovernance(
      { entries: [{ tag: '0001-present' }] },
      manifestFor({
        '0002-orphan': {
          strategy: 'compensating-migration',
          destructiveDownAllowed: false,
          note: 'Orphaned manifest entry.',
        },
      }),
    );

    expect(result.errors).toContain('0001-present: missing recovery-manifest entry');
    expect(result.errors).toContain('0002-orphan: recovery entry has no matching migration journal entry');
  });
});
