#!/usr/bin/env node

import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const { Client } = pg;

const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const ORGANIZATION_ID = '22222222-2222-4222-8222-222222222222';
const ADMIN_ROLE_ID = '33333333-3333-4333-8333-333333333333';
const LIMITED_ROLE_ID = '44444444-4444-4444-8444-444444444444';
const ADMIN_USER_ID = '55555555-5555-4555-8555-555555555555';
const LIMITED_USER_ID = '66666666-6666-4666-8666-666666666666';

const ADMIN_EMAIL = 'e2e@example.com';
const LIMITED_EMAIL = 'e2e-limited@example.com';
const PASSWORD = 'Password123!';

async function main() {
  const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('TEST_DATABASE_URL or DATABASE_URL is required');
    process.exit(2);
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO tenants (id, name, display_name, subdomain, slug, timezone, currency, locale, status, created_at)
       VALUES ($1, $2, $3, $4, $5, 'UTC', 'USD', 'en_US', 'active', NOW())
       ON CONFLICT (id) DO NOTHING`,
      [TENANT_ID, 'E2E Tenant', 'E2E Tenant', 'localhost', 'e2e'],
    );

    await client.query(
      `INSERT INTO organizations (id, tenant_id, code, name, legal_name, status, is_default, created_at)
       VALUES ($1, $2, $3, $4, $4, 'active', true, NOW())
       ON CONFLICT (id) DO NOTHING`,
      [ORGANIZATION_ID, TENANT_ID, 'E2E_ORG', 'E2E Organization'],
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

    const adminPermissions = [
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
      await client.query(
        `INSERT INTO permissions (id, module_code, resource, action, scope, permission_key, display_name, description, is_system)
         VALUES ($1, $2, $3, $4, 'tenant', $5, $6, $7, false)
         ON CONFLICT (permission_key) DO NOTHING`,
        [
          randomUUID(),
          moduleCode,
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
       VALUES ($1, $2, $3), ($1, $4, $3)
       ON CONFLICT (user_id, organization_id, tenant_id) DO NOTHING`,
      [TENANT_ID, ADMIN_USER_ID, ORGANIZATION_ID, LIMITED_USER_ID],
    );

    await client.query('COMMIT');
    console.log('E2E seed completed successfully.');
    console.log(`Seeded admin user: ${ADMIN_EMAIL}`);
    console.log(`Seeded limited user: ${LIMITED_EMAIL}`);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('E2E seed failed.', error);
    process.exit(3);
  } finally {
    await client.end();
  }
}

main();