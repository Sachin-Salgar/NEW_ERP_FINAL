ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS actor_platform_membership_id uuid;
ALTER TABLE auth_login_identifiers ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE auth_login_identifiers ALTER COLUMN user_id DROP NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'audit_events'::regclass
      AND conname = 'audit_events_actor_platform_membership_fk'
  ) THEN
    ALTER TABLE audit_events
      ADD CONSTRAINT audit_events_actor_platform_membership_fk
      FOREIGN KEY (actor_platform_membership_id)
      REFERENCES platform_memberships(id) ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_audit_events_platform_context_created_at
  ON audit_events (context_type, actor_platform_membership_id, created_at DESC);

CREATE TABLE IF NOT EXISTS platform_security_policy (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  mfa_required boolean NOT NULL DEFAULT false,
  session_lifetime_minutes integer NOT NULL DEFAULT 43200 CHECK (session_lifetime_minutes BETWEEN 5 AND 43200),
  max_failed_login_attempts integer NOT NULL DEFAULT 5 CHECK (max_failed_login_attempts BETWEEN 1 AND 20),
  lockout_minutes integer NOT NULL DEFAULT 15 CHECK (lockout_minutes BETWEEN 1 AND 1440),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO platform_security_policy (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
REVOKE ALL ON platform_security_policy FROM PUBLIC;

CREATE OR REPLACE FUNCTION platform_update_tenant_status(target_tenant uuid, requested_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF requested_status NOT IN ('active', 'suspended', 'cancelled') THEN
    RAISE EXCEPTION 'invalid tenant lifecycle status';
  END IF;
  UPDATE tenants
  SET status = requested_status::tenant_status_enum,
      is_deleted = (requested_status = 'cancelled'),
      deleted_at = CASE WHEN requested_status = 'cancelled' THEN now() ELSE NULL END,
      updated_at = now()
  WHERE id = target_tenant AND (is_deleted = false OR requested_status = 'active');
  IF NOT FOUND THEN RAISE EXCEPTION 'tenant not found'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION platform_update_tenant_status(uuid, text) FROM PUBLIC;
