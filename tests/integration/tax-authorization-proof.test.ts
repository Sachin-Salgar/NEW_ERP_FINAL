import { afterAll, describe, expect, it } from 'vitest';
import { v7 as uuidV7 } from 'uuid';
import { fixture, closeFixture, headers, login } from './authorization-proof-fixtures.js';
import { withTenantContext } from '../../src/infrastructure/database/tenant-context.js';
import { BcryptPasswordHasher } from '../../src/infrastructure/security/bcrypt-password-hasher.js';

describe('Tax Authorization Proof', () => {
  let value: Awaited<ReturnType<typeof fixture>>;
  afterAll(async () => { if (value) await closeFixture(value); });
  it('proves Tax entitlement, RBAC, tenant isolation, spoof resistance, RLS, and platform separation', async () => {
    value = await fixture();
    const tokenA = await login(value.app, value.tenantASeed, value.tenantA.tenantId);
    const tokenB = await login(value.app, value.tenantBSeed, value.tenantB.tenantId);
    const missing = await login(value.app, value.missingSeed, value.missing.tenantId);
    expect((await value.app.inject({ method: 'GET', url: '/api/v1/tax/rules' })).statusCode).toBe(401);
    const platformEmail = `tax-proof-platform-${uuidV7()}@example.com`;
    const platformPassword = 'TaxProofPlatformPassword123!';
    const identity = await value.adminPool.query<{ id: string }>(`INSERT INTO identities (status) VALUES ('active') RETURNING id`);
    await value.adminPool.query(
      `INSERT INTO auth_login_identifiers (identifier_type, identifier, tenant_id, user_id, identity_id, is_active)
       VALUES ('email', $1::citext, NULL, NULL, $2, true)`,
      [platformEmail, identity.rows[0].id],
    );
    await value.adminPool.query(
      `INSERT INTO identity_credentials (identity_id, provider, credential_type, secret_hash, password_changed_at)
       VALUES ($1, 'local', 'password', $2, now())`,
      [identity.rows[0].id, await new BcryptPasswordHasher().hash(platformPassword)],
    );
    const membership = await value.adminPool.query<{ id: string }>(
      `INSERT INTO platform_memberships (identity_id, status, activated_at) VALUES ($1, 'active', now()) RETURNING id`,
      [identity.rows[0].id],
    );
    const role = await value.adminPool.query<{ id: string }>(
      `SELECT id FROM platform_roles WHERE code = 'platform_owner' AND is_system = true`,
    );
    await value.adminPool.query(
      `INSERT INTO platform_membership_roles (platform_membership_id, platform_role_id) VALUES ($1, $2)`,
      [membership.rows[0].id, role.rows[0].id],
    );
    const platformLogin = await value.app.inject({
      method: 'POST',
      url: '/api/v1/auth/platform-login',
      payload: { identifier: platformEmail, password: platformPassword },
    });
    expect(platformLogin.statusCode).toBe(200);
    expect((await value.app.inject({ method: 'GET', url: '/api/v1/tax/rules', headers: { authorization: `Bearer ${platformLogin.json().accessToken}` } })).statusCode).toBe(401);
    const created = await value.app.inject({ method: 'POST', url: '/api/v1/tax/rules', headers: headers(tokenA, value.tenantA.tenantId), payload: { code: 'PROOF-TAX', name: 'Proof Tax', rate: 5, effectiveFrom: '2026-04-01' } });
    expect(created.statusCode).toBe(201);
    const id = created.json().rule.id as string;
    expect((await value.app.inject({ method: 'GET', url: '/api/v1/tax/rules', headers: headers(tokenA, value.tenantA.tenantId) })).json().rules).toHaveLength(1);
    expect((await value.app.inject({ method: 'GET', url: '/api/v1/tax/rules', headers: headers(tokenB, value.tenantB.tenantId) })).json().rules).toHaveLength(0);
    const spoofed = await value.app.inject({ method: 'GET', url: '/api/v1/tax/rules', headers: headers(tokenA, value.tenantB.tenantId) });
    expect(spoofed.json().rules).toHaveLength(1);
    expect(spoofed.json().rules[0].name).toBe('Proof Tax');
    expect((await value.app.inject({ method: 'PATCH', url: `/api/v1/tax/rules/${id}`, headers: headers(tokenB, value.tenantB.tenantId), payload: { name: 'tampered', rate: 9, expectedVersion: 1 } })).statusCode).toBe(400);
    const salesModule = await value.adminPool.query<{ id: string }>(`SELECT id FROM modules WHERE code = 'sales' LIMIT 1`);
    await value.adminPool.query(
      `UPDATE tenant_modules SET enabled = false, disabled_at = NOW(), disabled_by = NULL WHERE tenant_id = $1 AND module_id = $2`,
      [value.tenantB.tenantId, salesModule.rows[0].id],
    );
    expect((await value.app.inject({ method: 'GET', url: '/api/v1/tax/rules', headers: headers(tokenB, value.tenantB.tenantId) })).statusCode).toBe(403);
    expect((await value.app.inject({ method: 'GET', url: '/api/v1/tax/rules', headers: headers(missing, value.missing.tenantId) })).statusCode).toBe(403);
    const visibleForA = await withTenantContext(value.pool, 'app.current_tenant_id', value.tenantA.tenantId, (client) =>
      client.query('SELECT id FROM tax_rules WHERE tenant_id = $1', [value.tenantA.tenantId]),
    );
    const visibleForB = await withTenantContext(value.pool, 'app.current_tenant_id', value.tenantB.tenantId, (client) =>
      client.query('SELECT id FROM tax_rules WHERE tenant_id = $1', [value.tenantA.tenantId]),
    );
    expect(visibleForA.rows.map((row) => row.id)).toContain(id);
    expect(visibleForB.rows).toHaveLength(0);
    await expect(value.pool.query('SELECT id FROM tax_rules')).rejects.toThrow();
  });
});
