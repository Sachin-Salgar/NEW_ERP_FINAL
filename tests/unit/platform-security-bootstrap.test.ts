import { describe, expect, it } from 'vitest';
import type { Client } from 'pg';

import { runPlatformSecurityBootstrap } from '../../src/infrastructure/database/platform-security.js';

describe('platform security bootstrap transaction', () => {
  function createClient(statements: string[]) {
    return {
      query: async (sql: string) => {
        statements.push(sql);
        return { rows: [], rowCount: 0 };
      },
    };
  }

  it('commits after SQL and verification succeed', async () => {
    const statements: string[] = [];
    const client = createClient(statements);

    await runPlatformSecurityBootstrap(client as unknown as Client, undefined, async () => undefined);

    expect(statements).toEqual(['BEGIN', expect.stringContaining('CREATE OR REPLACE FUNCTION'), 'COMMIT']);
  });

  it('rolls back when verification fails', async () => {
    const statements: string[] = [];
    const client = createClient(statements);

    await expect(
      runPlatformSecurityBootstrap(
        client as unknown as Client,
        undefined,
        async () => {
          throw new Error('intentional verification failure');
        },
      ),
    ).rejects.toThrow('intentional verification failure');
    expect(statements).toEqual(['BEGIN', expect.stringContaining('CREATE OR REPLACE FUNCTION'), 'ROLLBACK']);
  });

  it('rolls back when bootstrap SQL fails', async () => {
    const statements: string[] = [];
    const client = {
      query: async (sql: string) => {
        statements.push(sql);
        if (sql !== 'BEGIN' && sql !== 'ROLLBACK') {
          throw new Error('intentional bootstrap failure');
        }
        return { rows: [], rowCount: 0 };
      },
    };

    await expect(runPlatformSecurityBootstrap(client as unknown as Client)).rejects.toThrow('intentional bootstrap failure');
    expect(statements).toEqual(['BEGIN', expect.stringContaining('CREATE OR REPLACE FUNCTION'), 'ROLLBACK']);
  });
});
