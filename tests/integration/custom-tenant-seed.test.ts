import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';

import { parseAppConfig, resolveDatabaseUrl } from '../../src/config/schema.js';
import { createApplication } from '../../src/presentation/http/app.js';
import {
  createIntegrationAdminPool,
  createIntegrationApplicationPool,
  resolveIntegrationAdminDatabaseUrl,
  resolveIntegrationApplicationDatabaseUrl,
} from './database.js';

const execFileAsync = promisify(execFile);
const runIfDatabase = it;
const tenantId = 'a7f2f4b0-2f11-4d2f-9a8a-4d7d9b2e1001';

describe('custom tenant seed vertical slice', () => {
  let applicationPool: Pool | undefined;
  let adminPool: Pool | undefined;
  let app: Awaited<ReturnType<typeof createApplication>> | undefined;

  afterAll(async () => {
    await app?.close();
    await applicationPool?.end();
    await adminPool?.end();
  });

  runIfDatabase('is deterministic, repeatable, and supports tenant-admin login', async () => {
    const administratorPassword = randomBytes(24).toString('base64url');
    const tenantUserPassword = randomBytes(24).toString('base64url');
    const managerPassword = randomBytes(24).toString('base64url');
    const seedEnvironment = {
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL: resolveIntegrationAdminDatabaseUrl(),
      TEST_DATABASE_URL: resolveIntegrationAdminDatabaseUrl(),
      DATABASE_SSL_MODE: 'disable',
      CUSTOM_TENANT_SEED_ENABLED: 'true',
      CUSTOM_TENANT_SEED_ALLOW_PRODUCTION: 'false',
      CUSTOM_TENANT_ADMIN_PASSWORD: administratorPassword,
      CUSTOM_TENANT_USER_PASSWORD: tenantUserPassword,
      CUSTOM_TENANT_MANAGER_PASSWORD: managerPassword,
    };
    for (let run = 0; run < 3; run += 1) {
      await execFileAsync(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'scripts/seed-custom-tenant.ts'], {
        cwd: process.cwd(),
        env: seedEnvironment,
        maxBuffer: 2 * 1024 * 1024,
      });
    }

    adminPool = new Pool({ connectionString: resolveIntegrationAdminDatabaseUrl(), ssl: false });
    const counts = await adminPool.query<{
      tenantCount: number;
      identityCount: number;
      userCount: number;
      roleAssignmentCount: number;
      branchCount: number;
    }>(
      `SELECT
         (SELECT COUNT(*)::int FROM tenants WHERE id = $1) AS "tenantCount",
         (SELECT COUNT(*)::int FROM identities i JOIN users u ON u.identity_id = i.id WHERE u.tenant_id = $1 AND u.username IN ('administrator', 'admin', 'manager')) AS "identityCount",
         (SELECT COUNT(*)::int FROM users WHERE tenant_id = $1 AND username IN ('administrator', 'admin', 'manager')) AS "userCount",
         (SELECT COUNT(*)::int FROM user_roles ur JOIN users u ON u.id = ur.user_id WHERE ur.tenant_id = $1 AND u.username IN ('administrator', 'admin', 'manager')) AS "roleAssignmentCount",
         (SELECT COUNT(*)::int FROM branches WHERE tenant_id = $1 AND is_deleted = false) AS "branchCount"`,
      [tenantId],
    );
    expect(counts.rows[0]).toEqual({
      tenantCount: 1,
      identityCount: 3,
      userCount: 3,
      roleAssignmentCount: 3,
      branchCount: 4,
    });

    applicationPool = createIntegrationApplicationPool();
    const databaseUrl = resolveDatabaseUrl(process.env, { forTest: true });
    const config = parseAppConfig({
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL: databaseUrl,
      DATABASE_SSL_MODE: 'disable',
      JWT_SECRET: 'custom-seed-integration-jwt-secret-2026',
      JWT_ISSUER: 'new-erp-final',
      API_PREFIX: '/api/v1',
    });
    app = await createApplication(config, applicationPool);

    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { identifier: 'administrator', password: administratorPassword },
    });
    expect(login.statusCode).toBe(200);
    const loginBody = login.json();
    expect(loginBody.user.username).toBe('administrator');
    expect(loginBody.user.tenantId).toBe(tenantId);
    expect(loginBody.session.tenantId).toBe(tenantId);
    expect(loginBody.accessToken).toBeTruthy();

    const me = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${loginBody.accessToken}` },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().user.id).toBe(loginBody.user.id);

    const authorizedOperation = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      headers: { authorization: `Bearer ${loginBody.accessToken}` },
      payload: {
        username: `seed-check-${randomBytes(8).toString('hex')}`,
        email: `seed-check-${randomBytes(8).toString('hex')}@example.com`,
        password: 'SeedCheckPassword123!',
      },
    });
    expect(authorizedOperation.statusCode).toBe(201);

    const platformOperation = await app.inject({
      method: 'GET',
      url: '/api/v1/platform/tenants',
      headers: { authorization: `Bearer ${loginBody.accessToken}` },
    });
    expect(platformOperation.statusCode).toBe(403);
  });
});

