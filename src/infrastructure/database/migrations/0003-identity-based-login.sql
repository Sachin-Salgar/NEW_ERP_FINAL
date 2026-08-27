-- Identity-based login support.
-- The authentication lookup table is deployment-independent and is not a tenant-data source.
-- It maps login identifiers to tenant user accounts so the backend can discover candidate tenants
-- before opening a tenant-scoped transaction. Password verification still occurs against the
-- tenant-scoped users row under RLS context.

CREATE TABLE IF NOT EXISTS auth_login_identifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier_type varchar(20) NOT NULL,
  identifier citext NOT NULL,
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT auth_login_identifiers_type_check CHECK (identifier_type IN ('email', 'username')),
  CONSTRAINT auth_login_identifiers_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT auth_login_identifiers_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT auth_login_identifiers_unique UNIQUE (identifier_type, identifier, tenant_id)
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_auth_login_identifiers_lookup
  ON auth_login_identifiers (identifier_type, identifier)
  WHERE is_active = true;--> statement-breakpoint

INSERT INTO auth_login_identifiers (identifier_type, identifier, tenant_id, user_id)
SELECT 'email', email::citext, tenant_id, id
FROM users
WHERE is_deleted = false
ON CONFLICT (identifier_type, identifier, tenant_id) DO NOTHING;--> statement-breakpoint

INSERT INTO auth_login_identifiers (identifier_type, identifier, tenant_id, user_id)
SELECT 'username', username::citext, tenant_id, id
FROM users
WHERE is_deleted = false
ON CONFLICT (identifier_type, identifier, tenant_id) DO NOTHING;--> statement-breakpoint

COMMENT ON TABLE auth_login_identifiers IS 'Deployment-independent login lookup index. It identifies candidate tenant user accounts before tenant-scoped authentication; it is not a tenant authorization boundary.';--> statement-breakpoint

COMMENT ON COLUMN auth_login_identifiers.tenant_id IS 'Candidate tenant discovered from the login identity. Membership and tenant authorization are validated by the application before a tenant session is created.';
