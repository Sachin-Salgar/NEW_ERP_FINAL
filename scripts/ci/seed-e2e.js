#!/usr/bin/env node

import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const { Client } = pg;

const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const ORGANIZATION_ID = '22222222-2222-4222-8222-222222222222';
const ORGANIZATION_TWO_ID = '77777777-7777-4777-8777-777777777777';
const LOCATION_ONE_ID = '88888888-8888-4888-8888-888888888888';
const LOCATION_TWO_ID = '99999999-9999-4999-8999-999999999999';
const ADMIN_ROLE_ID = '33333333-3333-4333-8333-333333333333';
const LIMITED_ROLE_ID = '44444444-4444-4444-8444-444444444444';
const ADMIN_USER_ID = '55555555-5555-4555-8555-555555555555';
const LIMITED_USER_ID = '66666666-6666-4666-8666-666666666666';

const ADMIN_EMAIL = 'e2e@example.com';
const LIMITED_EMAIL = 'e2e-limited@example.com';
const PASSWORD = 'Password123!';

const CORE_MODULES = [
  ['core', 'Core Platform', 'Administration', true, 1],
  ['security', 'Security', 'Administration', true, 2],
  ['organization', 'Organizations', 'Administration', true, 3],
  ['branch', 'Branches', 'Administration', true, 4],
  ['user-management', 'User Management', 'Administration', true, 5],
  ['tenant-configuration', 'Tenant Configuration', 'Administration', true, 6],
];

const E2E_MODULE = ['e2e-rbac', 'E2E RBAC Access', 'Administration', false, 100];

async function main() {
  try {
    console.log('--- E2E seed starting ---');
    console.log('Node version: ' + process.version);
    const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
    if (!databaseUrl) {
      console.error('TEST_DATABASE_URL or DATABASE_URL is required');
      process.exit(2);
    }
    const maskedDbUrl = databaseUrl.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
    console.log('Using TEST_DATABASE_URL (masked): ' + maskedDbUrl);
  } catch (preError) {
    console.error('Pre-seed diagnostics failed', preError && preError.stack ? preError.stack : preError);
  }

  const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('TEST_DATABASE_URL or DATABASE_URL is required');
    process.exit(2);
  }

  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
  } catch (connErr) {
    console.error('Failed to connect to database:', connErr && connErr.stack ? connErr.stack : connErr);
    process.exit(4);
  }

  try {
    console.log('DB connection successful, performing basic checks...');
    const v = await client.query('SELECT version() AS v');
    console.log('Postgres version:', v.rows && v.rows[0] && v.rows[0].v ? v.rows[0].v : '<unknown>');
    const tenantsTable = await client.query("SELECT to_regclass('public.tenants') as tenants_tbl");
    console.log('tenants table existence:', tenantsTable.rows[0].tenants_tbl);

    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [TENANT_ID]);

    for (const [code, name, moduleGroup, isCore, sortOrder] of [...CORE_MODULES, E2E_MODULE]) {
      await client.query(
        `INSERT INTO modules (id, code, name, module_group, is_core, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (code) DO UPDATE SET
           name = EXCLUDED.name,
           module_group = EXCLUDED.module_group,
           is_core = EXCLUDED.is_core,
           sort_order = EXCLUDED.sort_order`,
        [randomUUID(), code, name, moduleGroup, isCore, sortOrder],
      );
    }

    await client.query(
      `INSERT INTO tenants (id, name, display_name, subdomain, slug, timezone, currency, locale, status, created_at)
       VALUES ($1, $2, $3, $4, $5, 'UTC', 'USD', 'en_US', 'active', NOW())
       ON CONFLICT (id) DO NOTHING`,
      [TENANT_ID, 'E2E Tenant', 'E2E Tenant', 'localhost', 'e2e'],
    );

    await client.query(
      `INSERT INTO organizations (id, tenant_id, code, name, legal_name, status, is_default, created_at)
       VALUES ($1, $2, $3, $4, $4, 'active', true, NOW()),
              ($5, $2, $6, $7, $7, 'active', false, NOW())
       ON CONFLICT (id) DO NOTHING`,
      [
        ORGANIZATION_ID,
        TENANT_ID,
        'E2E_ORG',
        'E2E Organization',
        ORGANIZATION_TWO_ID,
        'E2E_ORG_2',
        'E2E Secondary Organization',
      ],
    );

    await client.query(
      `INSERT INTO tenant_modules (tenant_id, module_id, enabled, enabled_at)
       SELECT $1, m.id, true, NOW()
       FROM modules m
       WHERE m.code = ANY($2)
       ON CONFLICT (tenant_id, module_id) DO UPDATE
       SET enabled = true, disabled_at = NULL`,
      [TENANT_ID, [...CORE_MODULES.map(([code]) => code), E2E_MODULE[0]]],
    );

    await client.query(
      `INSERT INTO organization_modules (tenant_id, organization_id, module_id, enabled, enabled_at)
       SELECT $1, o.id, m.id, true, NOW()
       FROM organizations o
       CROSS JOIN modules m
       WHERE o.tenant_id = $1 AND m.code = ANY($2)
       ON CONFLICT (organization_id, module_id) DO UPDATE
       SET enabled = true, disabled_at = NULL`,
      [TENANT_ID, [...CORE_MODULES.map(([code]) => code), E2E_MODULE[0]]],
    );

    await client.query(
      `INSERT INTO locations (id, tenant_id, organization_id, code, name, status, is_default, timezone, created_at)
       VALUES ($1, $2, $3, 'E2E_LOC_1', 'E2E Main Location', 'active', true, 'UTC', NOW()),
              ($4, $2, $3, 'E2E_LOC_2', 'E2E Secondary Location', 'active', false, 'UTC', NOW())
       ON CONFLICT (id) DO NOTHING`,
      [LOCATION_ONE_ID, TENANT_ID, ORGANIZATION_ID, LOCATION_TWO_ID],
    );

    const adminPasswordHash = await bcrypt.hash(PASSWORD, 10);
    const limitedPasswordHash = await bcrypt.hash(PASSWORD, 10);

    await client.query(
      `INSERT INTO roles (id, tenant_id, code, name, description, is_system, sort_order, created_at)
       VALUES ($1, $2, $3, $4, $5, false, 100, NOW()),
              ($6, $2, $7, $8, $9, false, 200, NOW())
       ON CONFLICT (id) DO NOTHING`,
      [
        ADMIN_ROLE_ID,
        TENANT_ID,
        'e2e_admin',
        'E2E Admin',
        'Administrative role used by the E2E suite.',
        LIMITED_ROLE_ID,
        'e2e_limited',
        'E2E Limited',
        'Restricted role used by the E2E suite.',
      ],
    );

    await client.query(
      `INSERT INTO users (id, tenant_id, organization_id, username, email, password_hash, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'active', NOW()),
              ($7, $2, $3, $8, $9, $10, 'active', NOW())
       ON CONFLICT (id) DO NOTHING`,
      [
        ADMIN_USER_ID,
        TENANT_ID,
        ORGANIZATION_ID,
        'e2e@example.com',
        ADMIN_EMAIL,
        adminPasswordHash,
        LIMITED_USER_ID,
        'e2e-limited',
        LIMITED_EMAIL,
        limitedPasswordHash,
      ],
    );

    // Identity-based login requires deterministic E2E fixtures to seed the
    // deployment-independent login lookup explicitly. Production migrations
    // backfill this table for existing users; CI creates users after that
    // migration has already run, so the fixture must create the identities too.
    await client.query(
      `INSERT INTO auth_login_identifiers (identifier_type, identifier, tenant_id, user_id)
       VALUES ('email', $1, $2, $3),
              ('username', $4, $2, $3),
              ('email', $5, $2, $6),
              ('username', $7, $2, $6)
       ON CONFLICT (identifier_type, identifier, tenant_id) DO UPDATE
       SET user_id = EXCLUDED.user_id, is_active = true`,
      [ADMIN_EMAIL, TENANT_ID, ADMIN_USER_ID, 'e2e@example.com', LIMITED_EMAIL, LIMITED_USER_ID, 'e2e-limited'],
    );

    const adminPermissions = [
      'tenant.manage',
      'organization.read',
      'organization.manage',
      'user.read',
      'user.manage',
      'role.read',
      'role.manage',
      'permission.read',
      'permission.manage',
    ];

    const limitedPermissions = ['organization.read', 'user.read'];
    const allPermissionKeys = [...new Set([...adminPermissions, ...limitedPermissions])];

    for (const permissionKey of allPermissionKeys) {
      const [moduleCode, action] = permissionKey.split('.');
      const resolvedModuleCode = moduleCode === 'tenant' ? 'tenant-configuration' :
        moduleCode === 'user' ? 'user-management' :
        ['role', 'permission', 'session'].includes(moduleCode) ? E2E_MODULE[0] : moduleCode;
      await client.query(
        `INSERT INTO permissions (id, module_code, resource, action, scope, permission_key, display_name, description, is_system)
         VALUES ($1, $2, $3, $4, 'tenant', $5, $6, $7, false)
         ON CONFLICT (permission_key) DO UPDATE SET module_code = EXCLUDED.module_code`,
        [
          randomUUID(),
          resolvedModuleCode,
          moduleCode,
          action ?? 'read',
          permissionKey,
          permissionKey,
          `${permissionKey} permission`,
        ],
      );
    }

    await client.query(
      `INSERT INTO role_permissions (tenant_id, role_id, permission_id)
       SELECT $1, $2, p.id
       FROM permissions p
       WHERE p.permission_key = ANY($3)
       ON CONFLICT (role_id, permission_id, tenant_id) DO NOTHING`,
      [TENANT_ID, ADMIN_ROLE_ID, adminPermissions],
    );

    await client.query(
      `INSERT INTO role_permissions (tenant_id, role_id, permission_id)
       SELECT $1, $2, p.id
       FROM permissions p
       WHERE p.permission_key = ANY($3)
       ON CONFLICT (role_id, permission_id, tenant_id) DO NOTHING`,
      [TENANT_ID, LIMITED_ROLE_ID, limitedPermissions],
    );

    await client.query(
      `INSERT INTO user_roles (tenant_id, user_id, role_id)
       VALUES ($1, $2, $3), ($1, $4, $5)
       ON CONFLICT (user_id, role_id, tenant_id) DO NOTHING`,
      [TENANT_ID, ADMIN_USER_ID, ADMIN_ROLE_ID, LIMITED_USER_ID, LIMITED_ROLE_ID],
    );

    await client.query(
      `INSERT INTO user_organization_access (tenant_id, user_id, organization_id)
       VALUES ($1, $2, $3), ($1, $2, $4), ($1, $5, $3)
       ON CONFLICT (user_id, organization_id, tenant_id) DO NOTHING`,
      [TENANT_ID, ADMIN_USER_ID, ORGANIZATION_ID, ORGANIZATION_TWO_ID, LIMITED_USER_ID],
    );

    await client.query(
      `INSERT INTO user_location_access (tenant_id, user_id, organization_id, location_id, is_active)
       VALUES ($1, $2, $3, $4, true),
              ($1, $2, $3, $5, true)
       ON CONFLICT (user_id, location_id, tenant_id) DO UPDATE SET is_active = true`,
      [TENANT_ID, ADMIN_USER_ID, ORGANIZATION_ID, LOCATION_ONE_ID, LOCATION_TWO_ID],
    );

    await client.query('COMMIT');
    console.log('E2E seed completed successfully.');
    console.log(`Seeded admin user: ${ADMIN_EMAIL}`);
    console.log(`Seeded limited user: ${LIMITED_EMAIL}`);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('E2E seed failed. Error:');
    console.error(error && error.stack ? error.stack : error);
    process.exit(3);
  } finally {
    await client.end().catch(() => undefined);
  }
}

main();
