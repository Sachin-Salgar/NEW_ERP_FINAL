import { v7 as uuidV7 } from 'uuid';

import { resolveDatabaseSslMode, resolveDatabaseUrl } from '../src/config/schema.ts';
import { PlatformBootstrapService } from '../src/application/services/platform-bootstrap-service.ts';
import { BcryptPasswordHasher } from '../src/infrastructure/security/bcrypt-password-hasher.ts';
import { createDatabasePoolFromUrl } from '../src/infrastructure/database/connection.ts';
import { PostgresPlatformRepository } from '../src/infrastructure/database/repositories/postgres-platform-repository.ts';
import { withTenantContext } from '../src/infrastructure/database/tenant-context.ts';

/**
 * Manual bootstrap/restore for the real deployment test tenant.
 *
 * This fixture follows the approved Platform -> Tenant -> Branch contract.
 * It is disabled unless explicitly enabled and all credentials are supplied
 * through the environment.
 */
async function main() {
  const enabled = process.env.CUSTOM_TENANT_SEED_ENABLED === 'true';
  const isProduction = process.env.NODE_ENV === 'production';
  if (!enabled) {
    throw new Error('Custom tenant seed is disabled. Set CUSTOM_TENANT_SEED_ENABLED=true to run it intentionally.');
  }
  if (isProduction && process.env.CUSTOM_TENANT_SEED_ALLOW_PRODUCTION !== 'true') {
    throw new Error(
      'Custom tenant seed is blocked in production. Set CUSTOM_TENANT_SEED_ALLOW_PRODUCTION=true only for an intentional deployment bootstrap.',
    );
  }

  const passwords = {
    administrator: process.env.CUSTOM_TENANT_ADMIN_PASSWORD?.trim(),
    admin: process.env.CUSTOM_TENANT_USER_PASSWORD?.trim(),
    manager: process.env.CUSTOM_TENANT_MANAGER_PASSWORD?.trim(),
  };
  if (!passwords.administrator || !passwords.admin || !passwords.manager) {
    throw new Error(
      'CUSTOM_TENANT_ADMIN_PASSWORD, CUSTOM_TENANT_USER_PASSWORD, and CUSTOM_TENANT_MANAGER_PASSWORD are required.',
    );
  }

  const tenantId = 'a7f2f4b0-2f11-4d2f-9a8a-4d7d9b2e1001';
  const branchIds = [
    'a7f2f4b0-2f11-4d2f-9a8a-4d7d9b2e1003',
    'a7f2f4b0-2f11-4d2f-9a8a-4d7d9b2e1006',
    'a7f2f4b0-2f11-4d2f-9a8a-4d7d9b2e1007',
    'a7f2f4b0-2f11-4d2f-9a8a-4d7d9b2e1008',
  ];
  const userIds = [
    'a7f2f4b0-2f11-4d2f-9a8a-4d7d9b2e1004',
    'a7f2f4b0-2f11-4d2f-9a8a-4d7d9b2e1009',
    'a7f2f4b0-2f11-4d2f-9a8a-4d7d9b2e1010',
  ];
  const administratorRoleId = 'a7f2f4b0-2f11-4d2f-9a8a-4d7d9b2e1005';
  const managerRoleId = 'a7f2f4b0-2f11-4d2f-9a8a-4d7d9b2e1011';

  const pool = createDatabasePoolFromUrl(resolveDatabaseUrl(process.env), {
    sslMode: resolveDatabaseSslMode(process.env),
  });
  const repository = new PostgresPlatformRepository(pool);
  const platformBootstrap = new PlatformBootstrapService(repository);
  const passwordHasher = new BcryptPasswordHasher();

  try {
    console.log('Seeding platform reference data...');
    await platformBootstrap.seedReferenceData();

    await withTenantContext(pool, 'app.current_tenant_id', tenantId, async (client) => {
      await client.query(
        `INSERT INTO tenants (id, name, display_name, subdomain, slug, timezone, currency, locale, status, created_at, updated_at, version)
         VALUES ($1, 'Magod Fusion', 'Magod Fusion', 'magodfusion', 'magodfusion', 'Asia/Kolkata', 'INR', 'en_IN', 'active', NOW(), NOW(), 1)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, display_name = EXCLUDED.display_name, status = EXCLUDED.status`,
        [tenantId],
      );

      const branches = [
        ['Pune', 'Pune', true, true, 'Pune'],
        ['Chatrapati Sambhaji Nagar (CSN)', 'CSN', false, false, 'Chhatrapati Sambhajinagar'],
        ['Indapur', 'Indapur', false, false, 'Indapur'],
        ['Mumbai', 'Mumbai', false, false, 'Mumbai'],
      ] as const;
      for (const [index, [name, code, isHeadOffice, isDefault, city]] of branches.entries()) {
        await client.query(
          `INSERT INTO branches
             (id, tenant_id, code, name, status, is_head_office, is_default, city, state, country, timezone, created_at, updated_at, version)
           VALUES ($1, $2, $3, $4, 'active', $5, $6, $7, 'Maharashtra', 'IN', 'Asia/Kolkata', NOW(), NOW(), 1)
           ON CONFLICT (id) DO UPDATE SET code = EXCLUDED.code, name = EXCLUDED.name,
             status = EXCLUDED.status, is_head_office = EXCLUDED.is_head_office, is_default = EXCLUDED.is_default,
             city = EXCLUDED.city, updated_at = NOW()`,
          [branchIds[index], tenantId, code, name, isHeadOffice, isDefault, city],
        );
      }

      const roles = [
        [administratorRoleId, 'tenant-admin', 'Tenant Administrator'],
        [managerRoleId, 'manager', 'Manager'],
      ] as const;
      for (const [id, code, name] of roles) {
        await client.query(
          `INSERT INTO roles (id, tenant_id, code, name, description, is_system, sort_order, created_at, updated_at, version)
           VALUES ($1, $2, $3, $4, $5, false, 100, NOW(), NOW(), 1)
           ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description`,
          [id, tenantId, code, name, `${name} role used by the deployment test tenant.`],
        );
      }

      const adminPermissions = [
        'tenant.read',
        'branch.read',
        'branch.create',
        'branch.update',
        'branch.activate',
        'branch.deactivate',
        'user.read',
        'user.create',
        'user.update',
        'user.activate',
        'user.deactivate',
        'role.read',
        'role.create',
        'role.update',
        'role.activate',
        'role.deactivate',
        'role_permission.read',
        'role_permission.grant',
        'role_permission.revoke',
        'permission.read',
        'security.session.read',
        'security.session.revoke',
        'security.session.revoke_all',
        'customer.read',
        'customer.create',
        'customer.update',
        'customer.delete',
      ];
      const managerPermissions = ['branch.read', 'user.read'];
      const moduleForResource: Record<string, string> = {
        tenant: 'tenant-configuration',
        branch: 'branch',
        user: 'user-management',
        customer: 'crm',
      };
      for (const permissionKey of [...new Set([...adminPermissions, ...managerPermissions])]) {
        const [resource, action] = permissionKey.split('.');
        await client.query(
          `INSERT INTO permissions (id, module_code, resource, action, scope, permission_key, display_name, description, is_system)
           VALUES ($1, $2, $3, $4, 'tenant', $5, $5, $6, false)
           ON CONFLICT (permission_key) DO UPDATE SET module_code = EXCLUDED.module_code`,
          [
            uuidV7(),
            moduleForResource[resource] ??
              (resource === 'role' || resource === 'role_permission' ? 'security' : 'security'),
            resource,
            action,
            permissionKey,
            `${permissionKey} permission`,
          ],
        );
      }

      const users = [
        [userIds[0], 'administrator', 'administrator@magodfusion.in', passwords.administrator, branchIds[0]],
        [userIds[1], 'admin', 'admin@magodfusion.in', passwords.admin, branchIds[0]],
        [userIds[2], 'manager', 'manager@magodfusion.in', passwords.manager, branchIds[0]],
      ] as const;
      for (const [id, username, email, password, defaultBranchId] of users) {
        const passwordHash = await passwordHasher.hash(password);
        await client.query(
          `INSERT INTO users
             (id, tenant_id, default_branch_id, username, email, password_hash, status, created_at, updated_at, version)
           VALUES ($1, $2, $3, $4, $5, $6, 'active', NOW(), NOW(), 1)
           ON CONFLICT (id) DO UPDATE SET default_branch_id = EXCLUDED.default_branch_id,
             username = EXCLUDED.username, email = EXCLUDED.email,
             password_hash = EXCLUDED.password_hash, status = 'active', updated_at = NOW()`,
          [id, tenantId, defaultBranchId, username, email, passwordHash],
        );
        await client.query(
          `UPDATE identity_credentials c
           SET secret_hash = $1, password_changed_at = NOW(), updated_at = NOW()
           FROM users u WHERE u.id = $2 AND c.identity_id = u.identity_id`,
          [passwordHash, id],
        );
      }

      await client.query(`DELETE FROM user_branch_access WHERE tenant_id = $1 AND user_id = ANY($2::uuid[])`, [
        tenantId,
        userIds,
      ]);
      await client.query(
        `INSERT INTO user_branch_access (tenant_id, user_id, branch_id)
         SELECT $1, u, b FROM unnest($2::uuid[]) AS u CROSS JOIN unnest($3::uuid[]) AS b`,
        [tenantId, userIds.slice(0, 2), branchIds],
      );
      await client.query(
        `INSERT INTO user_branch_access (tenant_id, user_id, branch_id)
         SELECT $1, $2, b FROM unnest($3::uuid[]) AS b`,
        [tenantId, userIds[2], branchIds.slice(0, 2)],
      );

      await client.query(`DELETE FROM user_roles WHERE tenant_id = $1 AND user_id = ANY($2::uuid[])`, [
        tenantId,
        userIds,
      ]);
      await client.query(
        `INSERT INTO user_roles (tenant_id, user_id, role_id)
         VALUES ($1, $2, $3), ($1, $4, $3), ($1, $5, $6)`,
        [tenantId, userIds[0], administratorRoleId, userIds[1], userIds[2], managerRoleId],
      );
      await client.query(
        `INSERT INTO role_permissions (tenant_id, role_id, permission_id)
         SELECT $1, $2, p.id FROM permissions p WHERE p.permission_key = ANY($3)
         ON CONFLICT (role_id, permission_id, tenant_id) DO NOTHING`,
        [tenantId, administratorRoleId, adminPermissions],
      );
      await client.query(
        `INSERT INTO role_permissions (tenant_id, role_id, permission_id)
         SELECT $1, $2, p.id FROM permissions p WHERE p.permission_key = ANY($3)
         ON CONFLICT (role_id, permission_id, tenant_id) DO NOTHING`,
        [tenantId, managerRoleId, managerPermissions],
      );
    });

    const counts = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM tenants WHERE id = $1) AS "tenantCount",
         (SELECT COUNT(*)::int FROM branches WHERE tenant_id = $1 AND is_deleted = false) AS "branchCount",
         (SELECT COUNT(*)::int FROM users WHERE tenant_id = $1 AND username IN ('administrator', 'admin', 'manager')) AS "userCount"`,
      [tenantId],
    );
    if (counts.rows[0]?.tenantCount !== 1 || counts.rows[0]?.branchCount !== 4 || counts.rows[0]?.userCount !== 3) {
      throw new Error('Seed validation failed: expected one tenant, four branches, and three users.');
    }
    console.log(JSON.stringify({ tenant: 'Magod Fusion', branches: 4, users: 3 }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Custom tenant seed failed.');
  console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  process.exit(1);
});
