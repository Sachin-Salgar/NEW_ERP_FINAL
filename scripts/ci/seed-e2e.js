#!/usr/bin/env node

import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const { Client } = pg;

const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const BRANCH_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ADMIN_ROLE_ID = '33333333-3333-4333-8333-333333333333';
const LIMITED_ROLE_ID = '44444444-4444-4444-8444-444444444444';
const ADMIN_USER_ID = '55555555-5555-4555-8555-555555555555';
const LIMITED_USER_ID = '66666666-6666-4666-8666-666666666666';
const ADMIN_IDENTITY_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab';
const LIMITED_IDENTITY_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const ADMIN_EMAIL = 'e2e@example.com';
const LIMITED_EMAIL = 'e2e-limited@example.com';
const PASSWORD = 'Password123!';

const CORE_MODULES = [
  ['core', 'Core Platform', 'Administration', true, 1],
  ['security', 'Security', 'Administration', true, 2],
  ['branch', 'Branches', 'Administration', true, 3],
  ['user-management', 'User Management', 'Administration', true, 4],
  ['tenant-configuration', 'Tenant Configuration', 'Administration', true, 5],
  ['crm', 'CRM', 'Business', false, 6],
];

async function main() {
  const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (!databaseUrl) process.exit(2);
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [TENANT_ID]);

    for (const [code, name, moduleGroup, isCore, sortOrder] of CORE_MODULES) {
      await client.query(
        `INSERT INTO modules (id, code, name, module_group, is_core, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, module_group = EXCLUDED.module_group,
           is_core = EXCLUDED.is_core, sort_order = EXCLUDED.sort_order`,
        [randomUUID(), code, name, moduleGroup, isCore, sortOrder],
      );
    }

    await client.query(
      `INSERT INTO tenants (id, name, display_name, subdomain, slug, timezone, currency, locale, status, created_at)
       VALUES ($1, 'E2E Tenant', 'E2E Tenant', 'localhost', 'e2e', 'UTC', 'USD', 'en_US', 'active', NOW())
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, display_name = EXCLUDED.display_name,
        subdomain = EXCLUDED.subdomain, slug = EXCLUDED.slug, status = EXCLUDED.status`,
      [TENANT_ID],
    );

    await client.query(
      `INSERT INTO tenant_modules (tenant_id, module_id, enabled, enabled_at)
       SELECT $1, m.id, true, NOW() FROM modules m WHERE m.code = ANY($2)
       ON CONFLICT (tenant_id, module_id) DO UPDATE SET enabled = true, disabled_at = NULL`,
      [TENANT_ID, CORE_MODULES.map(([code]) => code)],
    );

    await client.query(
      `INSERT INTO branches (
         id, tenant_id, code, name, status, is_head_office, is_default,
         city, district, state, country, postal_code, timezone, remarks, created_at
       )
       VALUES (
         $1, $2, 'E2E_BRANCH_1', 'E2E Main Branch', 'active', true, true,
         'Pune', 'Pune', 'Maharashtra', 'India', '411001', 'Asia/Kolkata', 'E2E branch fixture', NOW()
       )
       ON CONFLICT (id) DO UPDATE SET code = EXCLUDED.code, name = EXCLUDED.name,
        status = EXCLUDED.status, is_head_office = EXCLUDED.is_head_office, is_default = EXCLUDED.is_default`,
      [BRANCH_ID, TENANT_ID],
    );

    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    await client.query(
      `INSERT INTO roles (id, tenant_id, code, name, description, is_system, sort_order, created_at)
       VALUES ($1, $2, 'e2e_admin', 'E2E Admin', 'Administrative role used by the E2E suite.', false, 100, NOW()),
              ($3, $2, 'e2e_limited', 'E2E Limited', 'Restricted role used by the E2E suite.', false, 200, NOW())
       ON CONFLICT (id) DO NOTHING`,
      [ADMIN_ROLE_ID, TENANT_ID, LIMITED_ROLE_ID],
    );

    await client.query(
      `INSERT INTO identities (id, status, created_at)
       VALUES ($1, 'active', NOW()), ($2, 'active', NOW())
      ON CONFLICT (id) DO NOTHING`,
      [ADMIN_IDENTITY_ID, LIMITED_IDENTITY_ID],
    );

    await client.query(
      `INSERT INTO tenant_memberships (identity_id, tenant_id, status, activated_at, revoked_at)
       VALUES ($1, $3, 'active', NOW(), NULL), ($2, $3, 'active', NOW(), NULL)
       ON CONFLICT (identity_id, tenant_id) DO UPDATE
         SET status = 'active',
             activated_at = COALESCE(tenant_memberships.activated_at, EXCLUDED.activated_at),
             revoked_at = NULL,
             updated_at = NOW()`,
      [ADMIN_IDENTITY_ID, LIMITED_IDENTITY_ID, TENANT_ID],
    );

    await client.query(
      `INSERT INTO identity_credentials (
        identity_id, provider, credential_type, secret_hash, status, password_changed_at, created_at, updated_at
      )
      VALUES ($1, 'local', 'password', $3, 'active', NOW(), NOW(), NOW()),
             ($2, 'local', 'password', $3, 'active', NOW(), NOW(), NOW())
      ON CONFLICT (identity_id, provider, credential_type) DO UPDATE
        SET secret_hash = EXCLUDED.secret_hash,
            status = 'active',
            failed_attempt_count = 0,
            locked_until = NULL,
            password_changed_at = EXCLUDED.password_changed_at,
            updated_at = NOW()`,
      [ADMIN_IDENTITY_ID, LIMITED_IDENTITY_ID, passwordHash],
    );

    await client.query(
      `INSERT INTO users (id, tenant_id, default_branch_id, username, email, password_hash, status, identity_id, created_at)
       VALUES ($1, $2, $3, 'e2e@example.com', $4, $5, 'active', $6, NOW()),
              ($7, $2, $3, 'e2e-limited', $8, $5, 'active', $9, NOW())
       ON CONFLICT (id) DO UPDATE SET default_branch_id = EXCLUDED.default_branch_id,
         password_hash = EXCLUDED.password_hash, status = EXCLUDED.status, email = EXCLUDED.email`,
      [
        ADMIN_USER_ID,
        TENANT_ID,
        BRANCH_ID,
        ADMIN_EMAIL,
        passwordHash,
        ADMIN_IDENTITY_ID,
        LIMITED_USER_ID,
        LIMITED_EMAIL,
        LIMITED_IDENTITY_ID,
      ],
    );

    await client.query(
      `INSERT INTO auth_login_identifiers (identifier_type, identifier, tenant_id, user_id, identity_id)
       VALUES ('email', $1, $2, $3, $6), ('username', 'e2e@example.com', $2, $3, $6),
              ('email', $4, $2, $5, $7), ('username', 'e2e-limited', $2, $5, $7)
       ON CONFLICT (identifier_type, identifier) DO UPDATE SET user_id = EXCLUDED.user_id, tenant_id = EXCLUDED.tenant_id, identity_id = EXCLUDED.identity_id, is_active = true`,
      [ADMIN_EMAIL, TENANT_ID, ADMIN_USER_ID, LIMITED_EMAIL, LIMITED_USER_ID, ADMIN_IDENTITY_ID, LIMITED_IDENTITY_ID],
    );

    const adminPermissions = [
      'tenant.read', 'branch.read', 'branch.create', 'branch.update', 'branch.activate', 'branch.deactivate',
      'user.read', 'user.create', 'user.update', 'user.activate', 'user.deactivate',
      'role.read', 'role.create', 'role.update', 'role.activate', 'role.deactivate',
      'role_permission.read', 'role_permission.grant', 'role_permission.revoke', 'permission.read',
      'security.session.read', 'security.session.revoke', 'security.session.revoke_all',
      'customer.read', 'customer.create', 'customer.update', 'customer.delete',
    ];
    const limitedPermissions = ['branch.read', 'user.read'];
    for (const permissionKey of [...new Set([...adminPermissions, ...limitedPermissions])]) {
      const [resource, action] = permissionKey.split('.');
      const moduleCode =
        resource === 'tenant' ? 'tenant-configuration' :
        resource === 'user' ? 'user-management' :
        resource === 'branch' ? 'branch' :
        resource === 'customer' ? 'crm' : 'security';
      await client.query(
        `INSERT INTO permissions (id, module_code, resource, action, scope, permission_key, display_name, description, is_system)
         VALUES ($1, $2, $3, $4, 'tenant', $5, $5, $6, false)
         ON CONFLICT (permission_key) DO UPDATE SET module_code = EXCLUDED.module_code`,
        [randomUUID(), moduleCode, resource, action, permissionKey, `${permissionKey} permission`],
      );
    }

    for (const [roleId, permissions] of [
      [ADMIN_ROLE_ID, adminPermissions],
      [LIMITED_ROLE_ID, limitedPermissions],
    ]) {
      await client.query(
        `INSERT INTO role_permissions (tenant_id, role_id, permission_id)
         SELECT $1, $2, p.id FROM permissions p WHERE p.permission_key = ANY($3)
         ON CONFLICT (role_id, permission_id, tenant_id) DO NOTHING`,
        [TENANT_ID, roleId, permissions],
      );
    }

    await client.query(
      `INSERT INTO user_roles (tenant_id, user_id, role_id) VALUES ($1, $2, $3), ($1, $4, $5)
       ON CONFLICT (user_id, role_id, tenant_id) DO NOTHING`,
      [TENANT_ID, ADMIN_USER_ID, ADMIN_ROLE_ID, LIMITED_USER_ID, LIMITED_ROLE_ID],
    );

    await client.query(
      `INSERT INTO user_branch_access (tenant_id, user_id, branch_id)
       VALUES ($1, $2, $3), ($1, $4, $3)
       ON CONFLICT (user_id, branch_id, tenant_id) DO NOTHING`,
      [TENANT_ID, ADMIN_USER_ID, BRANCH_ID, LIMITED_USER_ID],
    );

    const fixtureCheck = await client.query(
      `SELECT i.identity_id, c.secret_hash, m.id AS membership_id, u.id AS user_id
         FROM auth_login_identifiers i
         JOIN identity_credentials c
           ON c.identity_id = i.identity_id
          AND c.provider = 'local'
          AND c.credential_type = 'password'
          AND c.status = 'active'
         JOIN tenant_memberships m
           ON m.identity_id = i.identity_id
          AND m.tenant_id = $1
          AND m.status = 'active'
          AND m.revoked_at IS NULL
         JOIN users u
           ON u.identity_id = i.identity_id
          AND u.tenant_id = $1
          AND u.status = 'active'
          AND u.is_deleted = false
        WHERE i.identifier IN ($2, $3)
          AND i.is_active = true`,
      [TENANT_ID, ADMIN_EMAIL, LIMITED_EMAIL],
    );
    if (
      fixtureCheck.rowCount !== 2 ||
      !(await Promise.all(fixtureCheck.rows.map((row) => bcrypt.compare(PASSWORD, row.secret_hash)))).every(Boolean)
    ) {
      throw new Error('E2E authentication fixture verification failed.');
    }

    await client.query('COMMIT');
    console.log('E2E seed completed successfully.');
    console.log(`Seeded admin user: ${ADMIN_EMAIL}`);
    console.log(`Seeded limited user: ${LIMITED_EMAIL}`);
    console.log(`Seeded branch fixture: ${BRANCH_ID}`);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('E2E seed failed:', error?.stack ?? error);
    process.exit(3);
  } finally {
    await client.end().catch(() => undefined);
  }
}

main();