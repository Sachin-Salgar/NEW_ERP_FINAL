import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { resolveDatabaseUrl } from '../src/config/schema.js';

const operation = process.argv[2];
const email = process.argv[3];
const password = operation === 'recover' ? process.env.PLATFORM_ADMIN_RECOVERY_PASSWORD : process.env.PLATFORM_ADMIN_BOOTSTRAP_PASSWORD;
const secret = operation === 'recover' ? process.env.PLATFORM_ADMIN_RECOVERY_SECRET : process.env.PLATFORM_ADMIN_BOOTSTRAP_SECRET;
if (!['bootstrap', 'recover'].includes(operation ?? '')) throw new Error('Usage: platform-admin.ts bootstrap|recover <email>');
if (!secret || secret.length < 32) throw new Error('Required operator secret is missing or too short.');
if (!email || !email.includes('@')) throw new Error('A target administrator email is required.');
if (!password) throw new Error(operation === 'recover' ? 'PLATFORM_ADMIN_RECOVERY_PASSWORD is required.' : 'PLATFORM_ADMIN_BOOTSTRAP_PASSWORD is required.');

const pool = new Pool({ connectionString: resolveDatabaseUrl(process.env, { forTest: false }), ssl: undefined });
const lockKey = 'platform-admin-bootstrap-v1';
try {
  await pool.query('SELECT pg_advisory_lock(hashtext($1))', [lockKey]);
  await pool.query('BEGIN');
  const configured = await pool.query<{ used_at: Date | null }>(
    `SELECT used_at FROM security_bootstrap_state WHERE key = $1 FOR UPDATE`,
    [operation],
  );
  if (configured.rowCount === 1 && configured.rows[0].used_at) throw new Error('Operator operation has already been used.');
  if (operation === 'bootstrap') {
    const existing = await pool.query(`SELECT 1 FROM platform_memberships WHERE status = 'active' LIMIT 1`);
    if (existing.rowCount) throw new Error('Platform administration is already initialized.');
  }
  let identityId: string;
  if (operation === 'recover') {
    const existing = await pool.query<{ identityId: string }>(
      `SELECT identity_id AS "identityId" FROM auth_login_identifiers
       WHERE identifier_type = 'email' AND identifier = $1::citext AND is_active = true
       LIMIT 1`,
      [email],
    );
    if (existing.rowCount !== 1) throw new Error('Recovery requires an existing identity identifier.');
    identityId = existing.rows[0].identityId;
    await pool.query(`UPDATE identities SET status = 'active', security_version = security_version + 1, updated_at = now() WHERE id = $1`, [identityId]);
  } else {
    const identity = await pool.query<{ id: string }>(`INSERT INTO identities (status) VALUES ('active') RETURNING id`);
    identityId = identity.rows[0].id;
    await pool.query(
      `INSERT INTO auth_login_identifiers (identifier_type, identifier, tenant_id, user_id, identity_id, is_active)
       VALUES ('email', $1::citext, NULL, NULL, $2, true)
       ON CONFLICT (identifier_type, identifier) DO UPDATE
         SET identity_id = EXCLUDED.identity_id, is_active = true`,
      [email, identityId],
    );
  }
  await pool.query(
    `INSERT INTO identity_credentials (identity_id, provider, credential_type, secret_hash, password_changed_at)
     VALUES ($1, 'local', 'password', $2, now())
     ON CONFLICT (identity_id, provider, credential_type)
     DO UPDATE SET secret_hash = EXCLUDED.secret_hash, status = 'active', updated_at = now(), password_changed_at = now()`,
    [identityId, await bcrypt.hash(password, 12)],
  );
  const membership = await pool.query<{ id: string }>(
    `INSERT INTO platform_memberships (identity_id, status, activated_at) VALUES ($1, 'active', now())
     ON CONFLICT DO NOTHING RETURNING id`,
    [identityId],
  );
  const membershipId = membership.rows[0]?.id ?? (await pool.query<{ id: string }>(
    `SELECT id FROM platform_memberships WHERE identity_id = $1 AND status = 'active' LIMIT 1`,
    [identityId],
  )).rows[0]?.id;
  if (!membershipId) throw new Error('Unable to establish platform membership.');
  const role = await pool.query<{ id: string }>(`SELECT id FROM platform_roles WHERE code = 'platform_owner' AND is_system = true`);
  if (role.rowCount !== 1) throw new Error('Protected platform owner role is missing.');
  await pool.query(`INSERT INTO platform_membership_roles (platform_membership_id, platform_role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [membershipId, role.rows[0].id]);
  await pool.query(
    `INSERT INTO audit_events
      (tenant_id, actor_identity_id, actor_platform_membership_id, context_type, action, resource_type, resource_id, outcome, metadata)
    VALUES (NULL, $1, $2, 'platform', $3, 'platform_membership', $5::text, 'success', jsonb_build_object('email', $4::text))`,
    [identityId, membershipId, `platform.${operation}`, email, membershipId],
  );
  await pool.query(
    `INSERT INTO security_bootstrap_state (key, value, used_at) VALUES ($1, jsonb_build_object('email', $2::text), now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, used_at = now()`,
    [operation, email],
  );
  await pool.query('COMMIT');
  process.stdout.write(`${operation} completed.\n`);
} catch (error) {
  await pool.query('ROLLBACK').catch(() => undefined);
  throw error;
} finally {
  await pool.query('SELECT pg_advisory_unlock(hashtext($1))', [lockKey]).catch(() => undefined);
  await pool.end();
}
