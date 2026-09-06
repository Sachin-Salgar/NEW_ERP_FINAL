-- Compatibility wiring for existing tenant services while they adopt identity/membership IDs.
-- These triggers only derive server-owned relationships; they never accept client tenant authority.

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

CREATE OR REPLACE FUNCTION assign_user_identity_compatibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  resolved_identity uuid;
BEGIN
  IF NEW.identity_id IS NULL THEN
    INSERT INTO identities (status, created_at, updated_at)
    VALUES (
      CASE WHEN NEW.status = 'active' THEN 'active'::identity_status_enum
           WHEN NEW.status = 'locked' THEN 'locked'::identity_status_enum
           ELSE 'disabled'::identity_status_enum END,
      COALESCE(NEW.created_at, now()), NEW.updated_at
    )
    RETURNING id INTO resolved_identity;
    NEW.identity_id := resolved_identity;
  END IF;

  INSERT INTO identity_credentials (identity_id, secret_hash, password_changed_at)
  VALUES (NEW.identity_id, NEW.password_hash, COALESCE(NEW.password_changed_at, now()))
  ON CONFLICT (identity_id, provider, credential_type) DO UPDATE
    SET secret_hash = EXCLUDED.secret_hash,
        password_changed_at = COALESCE(EXCLUDED.password_changed_at, identity_credentials.password_changed_at),
        updated_at = now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION assign_user_identity_compatibility() FROM PUBLIC;
DROP TRIGGER IF EXISTS trg_assign_user_identity_compatibility ON users;
CREATE TRIGGER trg_assign_user_identity_compatibility
BEFORE INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION assign_user_identity_compatibility();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION assign_session_context_compatibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  resolved_identity uuid;
  resolved_membership uuid;
BEGIN
  IF NEW.context_type = 'tenant' AND NEW.identity_id IS NULL THEN
    SELECT identity_id INTO resolved_identity FROM users
    WHERE id = NEW.user_id AND tenant_id = NEW.tenant_id
    LIMIT 1;
    IF resolved_identity IS NULL THEN
      RAISE EXCEPTION 'Cannot create a session for an unmapped tenant user';
    END IF;
    NEW.identity_id := resolved_identity;
  END IF;

  IF NEW.context_type = 'tenant' AND NEW.tenant_membership_id IS NULL THEN
    SELECT id INTO resolved_membership FROM tenant_memberships
    WHERE identity_id = NEW.identity_id AND tenant_id = NEW.tenant_id
    LIMIT 1;
    IF resolved_membership IS NULL THEN
      INSERT INTO tenant_memberships (identity_id, tenant_id, status, activated_at)
      VALUES (NEW.identity_id, NEW.tenant_id, 'active', now())
      RETURNING id INTO resolved_membership;
    END IF;
    NEW.tenant_membership_id := resolved_membership;
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION assign_session_context_compatibility() FROM PUBLIC;
DROP TRIGGER IF EXISTS trg_assign_session_context_compatibility ON user_sessions;
CREATE TRIGGER trg_assign_session_context_compatibility
BEFORE INSERT ON user_sessions
FOR EACH ROW
EXECUTE FUNCTION assign_session_context_compatibility();
--> statement-breakpoint

DROP POLICY IF EXISTS audit_events_tenant_isolation_policy ON audit_events;
DROP POLICY IF EXISTS audit_events_tenant_context_policy ON audit_events;
CREATE POLICY audit_events_tenant_context_policy ON audit_events
  FOR ALL
  USING (
    context_type = 'tenant'
    AND tenant_id IS NOT NULL
    AND current_setting('app.current_tenant_id', true) <> ''
    AND tenant_id = current_setting('app.current_tenant_id', true)::uuid
  )
  WITH CHECK (
    context_type = 'tenant'
    AND tenant_id IS NOT NULL
    AND current_setting('app.current_tenant_id', true) <> ''
    AND tenant_id = current_setting('app.current_tenant_id', true)::uuid
  );
