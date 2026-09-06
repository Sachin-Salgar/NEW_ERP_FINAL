-- ADR-0040 additive identity, membership, platform authorization, and context foundation.
-- Legacy tenant columns remain during the compatibility period; authentication services may
-- migrate from users.password_hash after the new credential path is wired and verified.

SELECT set_config('app.current_tenant_id', '00000000-0000-0000-0000-000000000000', false);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'identity_status_enum') THEN
    CREATE TYPE identity_status_enum AS ENUM ('active', 'locked', 'disabled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'credential_status_enum') THEN
    CREATE TYPE credential_status_enum AS ENUM ('active', 'inactive', 'locked');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'membership_status_enum') THEN
    CREATE TYPE membership_status_enum AS ENUM ('active', 'suspended', 'revoked', 'pending');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'session_context_enum') THEN
    CREATE TYPE session_context_enum AS ENUM ('tenant', 'platform');
  END IF;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status identity_status_enum NOT NULL DEFAULT 'active',
  security_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  disabled_at timestamptz,
  CONSTRAINT identities_security_version_check CHECK (security_version > 0)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_identities_status ON identities (status);
CREATE INDEX IF NOT EXISTS idx_identities_security_version ON identities (security_version);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS identity_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id uuid NOT NULL REFERENCES identities(id) ON DELETE CASCADE,
  provider varchar(40) NOT NULL DEFAULT 'local',
  credential_type varchar(40) NOT NULL DEFAULT 'password',
  secret_hash varchar(255) NOT NULL,
  status credential_status_enum NOT NULL DEFAULT 'active',
  failed_attempt_count integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  password_changed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  CONSTRAINT identity_credentials_failed_attempts_check CHECK (failed_attempt_count >= 0),
  CONSTRAINT identity_credentials_provider_key UNIQUE (identity_id, provider, credential_type)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_identity_credentials_identity_status
  ON identity_credentials (identity_id, status);
--> statement-breakpoint

ALTER TABLE users ADD COLUMN IF NOT EXISTS identity_id uuid;
--> statement-breakpoint
INSERT INTO identities (id, status, created_at, updated_at)
SELECT u.id,
       CASE WHEN status = 'active' THEN 'active'::identity_status_enum
            WHEN status = 'locked' THEN 'locked'::identity_status_enum
            ELSE 'disabled'::identity_status_enum END,
       COALESCE(created_at, now()), updated_at
FROM users u
WHERE identity_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM identities i
    WHERE i.id = u.id
  );
--> statement-breakpoint
UPDATE users u
SET identity_id = i.id
FROM identities i
WHERE u.identity_id IS NULL
  AND i.id = u.id;
--> statement-breakpoint
DO $$
DECLARE
  user_row record;
  tenant_row record;
BEGIN
  FOR tenant_row IN SELECT id FROM tenants LOOP
    PERFORM set_config('app.current_tenant_id', tenant_row.id::text, false);
    FOR user_row IN SELECT id, status, created_at, updated_at FROM users WHERE identity_id IS NULL LOOP
      INSERT INTO identities (id, status, created_at, updated_at)
      VALUES (
        user_row.id,
        CASE WHEN user_row.status = 'active' THEN 'active'::identity_status_enum
             WHEN user_row.status = 'locked' THEN 'locked'::identity_status_enum
             ELSE 'disabled'::identity_status_enum END,
        COALESCE(user_row.created_at, now()), user_row.updated_at
      )
      ON CONFLICT (id) DO NOTHING;
      UPDATE users SET identity_id = user_row.id WHERE id = user_row.id;
    END LOOP;
  END LOOP;
  PERFORM set_config('app.current_tenant_id', '00000000-0000-0000-0000-000000000000', false);
END $$;
--> statement-breakpoint
INSERT INTO identity_credentials (identity_id, secret_hash, password_changed_at)
SELECT u.identity_id, u.password_hash, COALESCE(u.password_changed_at, now())
FROM users u
WHERE u.identity_id IS NOT NULL
ON CONFLICT (identity_id, provider, credential_type) DO NOTHING;
--> statement-breakpoint
ALTER TABLE users ALTER COLUMN identity_id SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'users'::regclass AND conname = 'users_identity_fk'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_identity_fk
      FOREIGN KEY (identity_id) REFERENCES identities(id) ON DELETE RESTRICT;
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_identity_tenant ON users (identity_id, tenant_id);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS tenant_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id uuid NOT NULL REFERENCES identities(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  status membership_status_enum NOT NULL DEFAULT 'active',
  security_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  activated_at timestamptz,
  suspended_at timestamptz,
  revoked_at timestamptz,
  revoked_by_identity_id uuid REFERENCES identities(id) ON DELETE SET NULL,
  CONSTRAINT tenant_memberships_identity_tenant_unique UNIQUE (identity_id, tenant_id),
  CONSTRAINT tenant_memberships_security_version_check CHECK (security_version > 0)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_tenant_memberships_identity_status ON tenant_memberships (identity_id, status);
CREATE INDEX IF NOT EXISTS idx_tenant_memberships_tenant_status ON tenant_memberships (tenant_id, status);
--> statement-breakpoint
INSERT INTO tenant_memberships (identity_id, tenant_id, status, created_at, activated_at)
SELECT u.identity_id, u.tenant_id,
       CASE WHEN u.status = 'active' AND NOT u.is_deleted THEN 'active'::membership_status_enum
            ELSE 'suspended'::membership_status_enum END,
       COALESCE(u.created_at, now()),
       CASE WHEN u.status = 'active' AND NOT u.is_deleted THEN COALESCE(u.created_at, now()) ELSE NULL END
FROM users u
ON CONFLICT (identity_id, tenant_id) DO NOTHING;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS platform_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id uuid NOT NULL REFERENCES identities(id) ON DELETE CASCADE,
  status membership_status_enum NOT NULL DEFAULT 'active',
  security_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  activated_at timestamptz,
  suspended_at timestamptz,
  revoked_at timestamptz,
  revoked_by_identity_id uuid REFERENCES identities(id) ON DELETE SET NULL,
  CONSTRAINT platform_memberships_security_version_check CHECK (security_version > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS uq_platform_memberships_active_identity
  ON platform_memberships (identity_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_platform_memberships_identity_status
  ON platform_memberships (identity_id, status);
--> statement-breakpoint

ALTER TABLE auth_login_identifiers ADD COLUMN IF NOT EXISTS identity_id uuid;
--> statement-breakpoint
UPDATE auth_login_identifiers a
SET identity_id = u.identity_id
FROM users u
WHERE a.identity_id IS NULL AND a.user_id = u.id AND a.tenant_id = u.tenant_id;
--> statement-breakpoint
DO $$
DECLARE
  tenant_row record;
BEGIN
  FOR tenant_row IN SELECT id FROM tenants LOOP
    PERFORM set_config('app.current_tenant_id', tenant_row.id::text, false);
    UPDATE auth_login_identifiers a
    SET identity_id = u.identity_id
    FROM users u
    WHERE a.identity_id IS NULL AND a.user_id = u.id AND a.tenant_id = u.tenant_id;
  END LOOP;
  PERFORM set_config('app.current_tenant_id', '00000000-0000-0000-0000-000000000000', false);
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'auth_login_identifiers'::regclass AND conname = 'auth_login_identifiers_identity_fk') THEN
    ALTER TABLE auth_login_identifiers ADD CONSTRAINT auth_login_identifiers_identity_fk
      FOREIGN KEY (identity_id) REFERENCES identities(id) ON DELETE CASCADE;
  END IF;
END $$;
ALTER TABLE auth_login_identifiers DROP CONSTRAINT IF EXISTS auth_login_identifiers_unique;
CREATE UNIQUE INDEX IF NOT EXISTS uq_auth_login_identifiers_identity_owned
  ON auth_login_identifiers (identifier_type, identifier);
CREATE INDEX IF NOT EXISTS idx_auth_login_identifiers_identity_type
  ON auth_login_identifiers (identity_id, identifier_type);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION sync_auth_login_identifiers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.is_deleted = false AND NEW.status = 'active' THEN
    INSERT INTO auth_login_identifiers (identifier_type, identifier, tenant_id, user_id, identity_id, is_active)
    VALUES
      ('email', NEW.email::citext, NEW.tenant_id, NEW.id, NEW.identity_id, true),
      ('username', NEW.username::citext, NEW.tenant_id, NEW.id, NEW.identity_id, true)
    ON CONFLICT (identifier_type, identifier) DO UPDATE
      SET tenant_id = EXCLUDED.tenant_id,
          user_id = EXCLUDED.user_id,
          identity_id = EXCLUDED.identity_id,
          is_active = true;
  ELSE
    UPDATE auth_login_identifiers SET is_active = false WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION sync_auth_login_identifiers() FROM PUBLIC;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS platform_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(80) NOT NULL UNIQUE,
  name varchar(150) NOT NULL,
  description text,
  is_system boolean NOT NULL DEFAULT false,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  version integer NOT NULL DEFAULT 1
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS platform_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_code varchar(100) NOT NULL,
  resource varchar(100) NOT NULL,
  action varchar(50) NOT NULL,
  scope permission_scope_enum NOT NULL DEFAULT 'global',
  permission_key varchar(180) NOT NULL UNIQUE,
  display_name varchar(150) NOT NULL,
  description text,
  is_system boolean NOT NULL DEFAULT false
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS platform_role_permissions (
  platform_role_id uuid NOT NULL REFERENCES platform_roles(id) ON DELETE CASCADE,
  platform_permission_id uuid NOT NULL REFERENCES platform_permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (platform_role_id, platform_permission_id)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS platform_membership_roles (
  platform_membership_id uuid NOT NULL REFERENCES platform_memberships(id) ON DELETE CASCADE,
  platform_role_id uuid NOT NULL REFERENCES platform_roles(id) ON DELETE RESTRICT,
  PRIMARY KEY (platform_membership_id, platform_role_id)
);
--> statement-breakpoint

INSERT INTO platform_permissions (module_code, resource, action, scope, permission_key, display_name, is_system)
VALUES
  ('platform', 'tenant', 'read', 'global', 'platform.tenant.read', 'Read tenants', true),
  ('platform', 'tenant', 'create', 'global', 'platform.tenant.create', 'Create tenants', true),
  ('platform', 'tenant', 'update', 'global', 'platform.tenant.update', 'Update tenants', true),
  ('platform', 'tenant', 'delete', 'global', 'platform.tenant.delete', 'Delete tenants', true),
  ('platform', 'tenant', 'activate', 'global', 'platform.tenant.activate', 'Activate tenants', true),
  ('platform', 'tenant', 'deactivate', 'global', 'platform.tenant.deactivate', 'Deactivate tenants', true),
  ('platform', 'tenant', 'suspend', 'global', 'platform.tenant.suspend', 'Suspend tenants', true),
  ('platform', 'tenant', 'reactivate', 'global', 'platform.tenant.reactivate', 'Reactivate tenants', true),
  ('platform', 'members', '*', 'global', 'platform.members.manage', 'Manage platform members', true),
  ('platform', 'roles', '*', 'global', 'platform.roles.manage', 'Manage platform roles', true),
  ('platform', 'permissions', '*', 'global', 'platform.permissions.manage', 'Manage platform permissions', true),
  ('platform', 'security', '*', 'global', 'platform.security.manage', 'Manage platform security', true),
  ('platform', 'audit', 'read', 'global', 'platform.audit.read', 'Read platform audit', true),
  ('platform', 'audit', 'export', 'global', 'platform.audit.export', 'Export platform audit', true)
ON CONFLICT (permission_key) DO NOTHING;
--> statement-breakpoint
INSERT INTO platform_roles (code, name, description, is_system)
VALUES ('platform_owner', 'Platform Owner', 'Protected platform administrator role', true)
ON CONFLICT (code) DO NOTHING;
--> statement-breakpoint
INSERT INTO platform_role_permissions (platform_role_id, platform_permission_id)
SELECT r.id, p.id FROM platform_roles r CROSS JOIN platform_permissions p
WHERE r.code = 'platform_owner' AND r.is_system = true
ON CONFLICT DO NOTHING;
--> statement-breakpoint

ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS identity_id uuid;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS context_type session_context_enum NOT NULL DEFAULT 'tenant';
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS tenant_membership_id uuid;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS platform_membership_id uuid;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS security_version integer NOT NULL DEFAULT 1;
--> statement-breakpoint
UPDATE user_sessions s
SET identity_id = u.identity_id,
    tenant_membership_id = m.id,
    security_version = i.security_version
FROM users u
JOIN identities i ON i.id = u.identity_id
JOIN tenant_memberships m ON m.identity_id = u.identity_id AND m.tenant_id = u.tenant_id
WHERE s.user_id = u.id AND s.tenant_id = u.tenant_id AND s.identity_id IS NULL;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'user_sessions'::regclass AND conname = 'user_sessions_identity_fk') THEN
    ALTER TABLE user_sessions ADD CONSTRAINT user_sessions_identity_fk FOREIGN KEY (identity_id) REFERENCES identities(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'user_sessions'::regclass AND conname = 'user_sessions_tenant_membership_fk') THEN
    ALTER TABLE user_sessions ADD CONSTRAINT user_sessions_tenant_membership_fk FOREIGN KEY (tenant_membership_id) REFERENCES tenant_memberships(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'user_sessions'::regclass AND conname = 'user_sessions_platform_membership_fk') THEN
    ALTER TABLE user_sessions ADD CONSTRAINT user_sessions_platform_membership_fk FOREIGN KEY (platform_membership_id) REFERENCES platform_memberships(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'user_sessions'::regclass AND conname = 'user_sessions_context_shape_check') THEN
    ALTER TABLE user_sessions ADD CONSTRAINT user_sessions_context_shape_check CHECK (
      (context_type = 'tenant' AND tenant_id IS NOT NULL AND tenant_membership_id IS NOT NULL AND platform_membership_id IS NULL AND user_id IS NOT NULL)
      OR
      (context_type = 'platform' AND tenant_id IS NULL AND tenant_membership_id IS NULL AND platform_membership_id IS NOT NULL AND user_id IS NULL)
    ) NOT VALID;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_user_sessions_identity_active ON user_sessions (identity_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_sessions_membership_active ON user_sessions (tenant_membership_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_sessions_platform_membership_active ON user_sessions (platform_membership_id, is_active);
--> statement-breakpoint

ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS context_type session_context_enum NOT NULL DEFAULT 'tenant';
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS actor_identity_id uuid;
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS actor_membership_id uuid;
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS target_tenant_id uuid;
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS permission_key varchar(180);
--> statement-breakpoint
UPDATE audit_events a
SET actor_identity_id = u.identity_id
FROM users u
WHERE a.actor_user_id = u.id AND a.actor_identity_id IS NULL;
--> statement-breakpoint
UPDATE audit_events a
SET actor_membership_id = m.id
FROM tenant_memberships m
WHERE a.actor_identity_id = m.identity_id
  AND a.tenant_id = m.tenant_id
  AND a.actor_membership_id IS NULL;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'audit_events'::regclass AND conname = 'audit_events_actor_identity_fk') THEN
    ALTER TABLE audit_events ADD CONSTRAINT audit_events_actor_identity_fk
      FOREIGN KEY (actor_identity_id) REFERENCES identities(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'audit_events'::regclass AND conname = 'audit_events_actor_membership_fk') THEN
    ALTER TABLE audit_events ADD CONSTRAINT audit_events_actor_membership_fk
      FOREIGN KEY (actor_membership_id) REFERENCES tenant_memberships(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'audit_events'::regclass AND conname = 'audit_events_target_tenant_fk') THEN
    ALTER TABLE audit_events ADD CONSTRAINT audit_events_target_tenant_fk
      FOREIGN KEY (target_tenant_id) REFERENCES tenants(id) ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_audit_events_context_created_at ON audit_events (context_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor_identity_created_at ON audit_events (actor_identity_id, created_at DESC);
--> statement-breakpoint

DROP POLICY IF EXISTS audit_events_tenant_isolation_policy ON audit_events;
CREATE POLICY audit_events_tenant_context_policy ON audit_events
  FOR ALL
  USING (context_type = 'tenant' AND tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (context_type = 'tenant' AND tenant_id = current_setting('app.current_tenant_id', true)::uuid);
