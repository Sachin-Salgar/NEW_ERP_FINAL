import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';

import { parseAppConfig, resolveDatabaseUrl } from '../../src/config/schema.js';
import { createApplication } from '../../src/presentation/http/app.js';
import { runMigrations } from '../../src/infrastructure/database/migrate.js';
import { PostgresPlatformRepository } from '../../src/infrastructure/database/repositories/postgres-platform-repository.js';
import { PlatformBootstrapService } from '../../src/application/services/platform-bootstrap-service.js';
import { UnitOfWork } from '../../src/infrastructure/database/unit-of-work.js';
import { PostgresAuditLogger } from '../../src/infrastructure/audit/postgres-audit-logger.js';
import { v7 as uuidV7 } from 'uuid';

const execFileAsync = promisify(execFile);
const adminUrl = resolveDatabaseUrl(process.env, { forTest: false });

describe('fresh zero-state platform acceptance', () => {
  let databaseName: string | undefined;
  let adminPool: Pool | undefined;
  let setupPool: Pool | undefined;
  let appPool: Pool | undefined;
  let app: Awaited<ReturnType<typeof createApplication>> | undefined;

  afterAll(async () => {
    await app?.close().catch(() => undefined);
    await appPool?.end();
    await setupPool?.end();
    if (adminPool && databaseName) {
      await adminPool.query(
        'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
        [databaseName],
      );
      await adminPool.query(`DROP DATABASE "${databaseName}"`);
    }
    await adminPool?.end();
  });

  it('bootstraps, isolates, revokes, audits, and rolls back on a clean database', async () => {
    expect(adminUrl).toBeTruthy();
    databaseName = `erp_acceptance_${Date.now()}`;
    adminPool = new Pool({ connectionString: adminUrl });
    await adminPool.query(`CREATE DATABASE "${databaseName}"`);
    const temporaryUrl = new URL(adminUrl!);
    temporaryUrl.pathname = `/${databaseName}`;
    const databaseUrl = temporaryUrl.toString();

    await runMigrations(databaseUrl, 'disable');
    const securitySql = await readFile(new URL('../../scripts/platform-security.sql', import.meta.url), 'utf8');
    await adminPool.query(`SELECT 1`);
    setupPool = new Pool({ connectionString: databaseUrl });
    await setupPool.query(securitySql);
    const rolePassword = process.env.ADR0040_SECURITY_ROLE_PASSWORD ?? 'integration-role-password-2026!';
    for (const role of ['erp_app', 'erp_platform_executor', 'erp_procedure_owner']) {
      await setupPool.query(`ALTER ROLE "${role}" LOGIN PASSWORD '${rolePassword.replaceAll("'", "''")}'`);
    }
    await setupPool.query('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO erp_app');
    await setupPool.query('GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO erp_app');
    await new PlatformBootstrapService(new PostgresPlatformRepository(setupPool)).seedReferenceData();
    const retiredPermissions = await setupPool.query(
      `SELECT permission_key
       FROM permissions
       WHERE permission_key = ANY($1::text[])`,
      [
        [
          'tenant.manage',
          'organization.manage',
          'branch.manage',
          'user.manage',
          'role.manage',
          'permission.manage',
          'session.manage',
        ],
      ],
    );
    expect(retiredPermissions.rows).toEqual([]);
    const sessionColumn = await setupPool.query(
      `SELECT is_nullable FROM information_schema.columns WHERE table_name = 'user_sessions' AND column_name = 'tenant_id'`,
    );
    expect(sessionColumn.rows[0]?.is_nullable).toBe('YES');

    const secret = `acceptance-secret-${uuidV7()}-long`;
    const password = 'AcceptancePassword123!';
    const email = `platform-${Date.now()}@example.com`;
    const cliEnv = {
      ...process.env,
      DATABASE_URL: databaseUrl,
      PLATFORM_ADMIN_BOOTSTRAP_SECRET: secret,
      PLATFORM_ADMIN_BOOTSTRAP_PASSWORD: password,
    };
    const tsx = fileURLToPath(new URL('../../node_modules/tsx/dist/cli.mjs', import.meta.url));
    const runBootstrap = (environment: NodeJS.ProcessEnv) =>
      execFileAsync(process.execPath, [tsx, 'scripts/platform-admin.ts', 'bootstrap', email], {
        env: environment,
        cwd: process.cwd(),
      });
    const cli = await runBootstrap(cliEnv);
    expect(cli.stdout).toContain('bootstrap completed');
    await expect(runBootstrap(cliEnv)).rejects.toThrow();
    await expect(runBootstrap({ ...cliEnv, PLATFORM_ADMIN_BOOTSTRAP_SECRET: 'invalid-secret' })).rejects.toThrow();
    const plaintext = await setupPool.query(
      `SELECT count(*)::int AS count FROM pg_catalog.pg_tables WHERE schemaname = 'public'`,
    );
    expect(plaintext.rows[0].count).toBeGreaterThan(0);

    const applicationUrl = new URL(databaseUrl);
    applicationUrl.username = 'erp_app';
    applicationUrl.password = rolePassword;
    appPool = new Pool({ connectionString: applicationUrl.toString(), ssl: false });
    const platformConfig = parseAppConfig({ ...process.env, DATABASE_URL: databaseUrl, NODE_ENV: 'test' });
    app = await createApplication(platformConfig, setupPool);
    await app.ready();
    const request = async (
      method: 'GET' | 'POST' | 'PATCH',
      url: string,
      token?: string,
      payload?: object,
    ): Promise<any> =>
      app!.inject({ method, url, headers: token ? { authorization: `Bearer ${token}` } : undefined, payload });

    const platformLogin = await request('POST', '/api/v1/auth/platform-login', undefined, {
      identifier: email,
      password,
    });
    expect(platformLogin.statusCode, platformLogin.body).toBe(200);
    const platformToken = platformLogin.json().accessToken as string;

    const suffix = Date.now();
    const createTenant = (name: string, user: string) =>
      request('POST', '/api/v1/platform/tenants', platformToken, {
        name,
        displayName: name,
        subdomain: `sub-${user}`,
        slug: `slug-${user}`,
        administrator: { username: user, email: `${user}@example.com`, password },
        organization: { name: `${name} Org` },
        branch: { name: `${name} Branch` },
      });
    const tenantAResponse = await createTenant(`Tenant A ${suffix}`, `tenant-a-${suffix}`);
    const tenantBResponse = await createTenant(`Tenant B ${suffix}`, `tenant-b-${suffix}`);
    expect(tenantAResponse.statusCode).toBe(201);
    expect(tenantBResponse.statusCode).toBe(201);
    const tenantA = tenantAResponse.json().tenantId as string;
    const tenantB = tenantBResponse.json().tenantId as string;

    await app.close();
    app = await createApplication(
      parseAppConfig({ ...process.env, DATABASE_URL: applicationUrl.toString(), NODE_ENV: 'test' }),
      appPool,
    );

    const tenantLogin = await request('POST', '/api/v1/auth/login', undefined, {
      identifier: `tenant-a-${suffix}`,
      password,
    });
    expect(tenantLogin.statusCode).toBe(200);
    const tenantToken = tenantLogin.json().accessToken as string;
    expect(
      (await request('POST', '/api/v1/auth/context', tenantToken, { contextType: 'tenant', tenantId: tenantB }))
        .statusCode,
    ).toBe(403);
    expect((await request('GET', '/api/v1/platform/tenants', tenantToken)).statusCode).toBe(403);
    for (const path of [
      '/api/v1/platform/members',
      '/api/v1/platform/roles',
      '/api/v1/platform/security-policy',
      '/api/v1/platform/audit',
    ]) {
      expect((await request('GET', path, tenantToken)).statusCode).toBe(403);
    }
    expect((await request('GET', `/api/v1/customers/${tenantB}`, tenantToken)).statusCode).not.toBe(200);

    const platformCustomers = await request('GET', '/api/v1/customers', platformToken);
    expect(platformCustomers.statusCode).not.toBe(200);
    expect((await request('GET', '/api/v1/inventory/items', platformToken)).statusCode).not.toBe(200);
    expect((await request('GET', '/api/v1/sales/reports/document-summary', platformToken)).statusCode).not.toBe(200);
    expect((await request('GET', '/api/v1/purchases', platformToken)).statusCode).not.toBe(200);
    const tenantAContext = await request('POST', '/api/v1/auth/context', tenantToken, {
      contextType: 'tenant',
      tenantId: tenantA,
    });
    expect(tenantAContext.statusCode).toBe(200);
    const tenantAToken = tenantAContext.json().accessToken as string;
    const organizationId = tenantLogin.json().user.organizationId as string;
    const customer = await request('POST', '/api/v1/customers', tenantAToken, {
      name: `Customer ${suffix}`,
      organizationId,
    });
    expect(customer.statusCode).toBe(201);
    const headerSpoof = await app.inject({
      method: 'GET',
      url: '/api/v1/customers',
      headers: { authorization: `Bearer ${tenantAToken}`, 'x-tenant-id': tenantB },
    });
    expect(headerSpoof.statusCode).toBe(200);
    expect(
      headerSpoof
        .json()
        .customers.every((entry: { organizationId: string }) => entry.organizationId === organizationId),
    ).toBe(true);
    const alteredJwt = `${tenantAToken.slice(0, -1)}${tenantAToken.endsWith('a') ? 'b' : 'a'}`;
    expect((await request('GET', '/api/v1/customers', alteredJwt)).statusCode).toBe(401);

    const events = await setupPool.query(
      `SELECT actor_identity_id, actor_platform_membership_id, context_type, tenant_id, target_tenant_id FROM audit_events WHERE context_type = 'platform'`,
    );
    expect(events.rowCount).toBeGreaterThan(0);
    expect(
      events.rows.some(
        (row) => row.actor_identity_id && row.actor_platform_membership_id && row.context_type === 'platform',
      ),
    ).toBe(true);
    const platformMembership = await setupPool.query<{ id: string }>(
      'SELECT id FROM platform_memberships WHERE status = $1 LIMIT 1',
      ['active'],
    );
    await setupPool.query('UPDATE platform_memberships SET status = $2, revoked_at = now() WHERE id = $1', [
      platformMembership.rows[0].id,
      'revoked',
    ]);
    expect((await request('GET', '/api/v1/platform/tenants', platformToken)).statusCode).not.toBe(200);
    expect((await request('GET', '/api/v1/customers', tenantAToken)).statusCode).toBe(200);

    const uow = new UnitOfWork(setupPool);
    const audit = new PostgresAuditLogger(setupPool, { tenantContextKey: 'app.current_tenant_id' });
    const marker = uuidV7();
    await expect(
      uow.runInTransaction(async () => {
        await uow
          .getClient()
          .query('INSERT INTO security_bootstrap_state (key, value) VALUES ($1, $2)', [`acceptance-${marker}`, '{}']);
        await audit.record(
          {
            tenantId: '00000000-0000-0000-0000-000000000000',
            action: 'acceptance.rollback',
            resourceType: 'test',
            resourceId: marker,
            outcome: 'success',
          },
          { requireTransaction: true },
        );
      }),
    ).rejects.toThrow();
    expect(
      (await setupPool.query('SELECT 1 FROM security_bootstrap_state WHERE key = $1', [`acceptance-${marker}`]))
        .rowCount,
    ).toBe(0);
  });
});
