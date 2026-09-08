import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';

import { resolveDatabaseUrl } from '../../src/config/schema.js';
import { PostgresPlatformRepository } from '../../src/infrastructure/database/repositories/postgres-platform-repository.js';
import { PlatformBootstrapService } from '../../src/application/services/platform-bootstrap-service.js';
import { createIntegrationApplicationPool } from './database.js';

async function sourceText(directory: string): Promise<string> {
  const files = await readdir(directory, { withFileTypes: true });
  let result = '';
  for (const file of files) {
    const path = join(directory, file.name);
    if (file.isDirectory()) result += await sourceText(path);
    else if (file.name.endsWith('.ts') || file.name.endsWith('.dart')) result += await readFile(path, 'utf8');
  }
  return result;
}

describe('machine-derived permission inventory', () => {
  let pool: Pool;
  let source = '';

  beforeAll(async () => {
    pool = createIntegrationApplicationPool();
    await new PlatformBootstrapService(new PostgresPlatformRepository(pool)).seedReferenceData();
    source = await sourceText(join(process.cwd(), 'src'));
  });

  afterAll(async () => pool.end());

  it('has an enforcement reference for every active catalog permission', async () => {
    const result = await pool.query<{
      permissionKey: string;
      moduleCode: string;
      resource: string;
      action: string;
      scope: string;
    }>(
      `SELECT permission_key AS "permissionKey", module_code AS "moduleCode", resource, action, scope FROM permissions
       UNION ALL
       SELECT permission_key AS "permissionKey", module_code AS "moduleCode", resource, action, scope FROM platform_permissions WHERE is_system = true`,
    );
    const missing = result.rows.filter((permission) => {
      if (source.includes(`'${permission.permissionKey}'`) || source.includes(`"${permission.permissionKey}"`))
        return false;
      const prefix = `${permission.moduleCode}.${permission.resource}`;
      return !source.includes(prefix) && !source.includes(`resource: '${permission.resource}'`);
    });
    expect({ total: result.rowCount, missing: missing.map((permission) => permission.permissionKey) }).toEqual({
      total: result.rowCount,
      missing: [],
    });
  });
});

