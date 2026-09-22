import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { resolveDatabaseUrl } from '../../config/schema.js';

export async function seedPlatformAdmin(): Promise<void> {
  const username = process.env.PLATFORM_ADMIN_USERNAME?.trim();
  const password = process.env.PLATFORM_ADMIN_PASSWORD;
  const email = process.env.PLATFORM_ADMIN_EMAIL?.trim();

  if (!username) throw new Error('PLATFORM_ADMIN_USERNAME is required.');
  if (!password) throw new Error('PLATFORM_ADMIN_PASSWORD is required.');
  if (!email || !email.includes('@')) throw new Error('PLATFORM_ADMIN_EMAIL must be a valid email address.');

  const pool = new Pool({
    connectionString: resolveDatabaseUrl(process.env, { forTest: false }),
    ssl: undefined,
  });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['platform-admin-seed-v1']);

    const existingPlatform = await client.query<{ identity_id: string }>(
      `SELECT identity_id
         FROM platform_memberships
        WHERE status = 'active'
        LIMIT 1
        FOR UPDATE`,
    );

    let identityId: string;
    let created = false;

    const usernameIdentifier = await client.query<{ identity_id: string }>(
      `SELECT identity_id
         FROM auth_login_identifiers
        WHERE identifier_type = 'username'
          AND identifier = $1::citext
          AND is_active = true
        LIMIT 1
        FOR UPDATE`,
      [username],
    );

    if (usernameIdentifier.rowCount === 1) {
      identityId = usernameIdentifier.rows[0].identity_id;
    } else {
      if (existingPlatform.rowCount === 1) {
        throw new Error(
          'A different active platform administrator already exists. Refusing to create a second default platform administrator automatically.',
        );
      }

      const identity = await client.query<{ id: string }>(
        `INSERT INTO identities (status) VALUES ('active') RETURNING id`,
      );
      identityId = identity.rows[0].id;
      created = true;

      await client.query(
        `INSERT INTO auth_login_identifiers
          (identifier_type, identifier, tenant_id, user_id, identity_id, is_active)
         VALUES ('username', $1::citext, NULL, NULL, $2, true)`,
        [username, identityId],
      );
    }

    const conflictingEmail = await client.query<{ identity_id: string }>(
      `SELECT identity_id
         FROM auth_login_identifiers
        WHERE identifier_type = 'email'
          AND identifier = $1::citext
          AND is_active = true
          AND identity_id <> $2
        LIMIT 1`,
      [email, identityId],
    );
    if (conflictingEmail.rowCount === 1) {
      throw new Error('PLATFORM_ADMIN_EMAIL is already assigned to a different active identity.');
    }

    await client.query(
      `INSERT INTO auth_login_identifiers
        (identifier_type, identifier, tenant_id, user_id, identity_id, is_active)
       VALUES ('email', $1::citext, NULL, NULL, $2, true)
       ON CONFLICT (identifier_type, identifier) DO UPDATE
         SET identity_id = EXCLUDED.identity_id, tenant_id = NULL, user_id = NULL, is_active = true`,
      [email, identityId],
    );

    await client.query(
      `UPDATE identities
          SET status = 'active',
              security_version = security_version + 1,
              updated_at = now()
        WHERE id = $1`,
      [identityId],
    );

    const membership = await client.query<{ id: string }>(
      `INSERT INTO platform_memberships (identity_id, status, activated_at)
       VALUES ($1, 'active', now())
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [identityId],
    );

    const membershipId =
      membership.rows[0]?.id ??
      (
        await client.query<{ id: string }>(
          `SELECT id
             FROM platform_memberships
            WHERE identity_id = $1
            ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, created_at DESC
            LIMIT 1`,
          [identityId],
        )
      ).rows[0]?.id ?? '';

    if (!membershipId) throw new Error('Unable to establish platform membership.');

    await client.query(
      `UPDATE platform_memberships
          SET status = 'active',
              activated_at = COALESCE(activated_at, now())
        WHERE id = $1`,
      [membershipId],
    );

    const role = await client.query<{ id: string }>(
      `SELECT id
         FROM platform_roles
        WHERE code = 'platform_owner'
          AND is_system = true
        LIMIT 1`,
    );
    if (role.rowCount !== 1) {
      throw new Error('Protected platform_owner role is missing. Run platform security bootstrap first.');
    }

    await client.query(
      `INSERT INTO platform_membership_roles (platform_membership_id, platform_role_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [membershipId, role.rows[0].id],
    );

    if (created) {
      await client.query(
        `INSERT INTO identity_credentials
          (identity_id, provider, credential_type, secret_hash, password_changed_at)
         VALUES ($1, 'local', 'password', $2, now())`,
        [identityId, await bcrypt.hash(password, 12)],
      );
    }

    await client.query(
      `INSERT INTO audit_events
        (tenant_id, actor_identity_id, actor_platform_membership_id, context_type, action,
         resource_type, resource_id, outcome, metadata)
       VALUES (NULL, $1, $2, 'platform', 'platform.seed', 'platform_membership',
               $2::text, 'success',
               jsonb_build_object('username', $3::text, 'email', $4::text, 'created', $5::boolean))`,
      [identityId, membershipId, username, email, created],
    );

    await client.query('COMMIT');
    process.stdout.write(
      created
        ? 'Platform administrator seeded successfully.\n'
        : 'Platform administrator already exists; access configuration verified without changing the password.\n',
    );
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1].replaceAll('\\', '/')) {
  seedPlatformAdmin().catch((error: unknown) => {
    console.error('Platform administrator seed failed', error);
    process.exitCode = 1;
  });
}
