-- Keep the deployment-independent login lookup index synchronized with tenant users.
-- Migration 0003 populated the index only once, which meant users created later
-- (including deployment bootstrap users) could not log in by username or email.

CREATE OR REPLACE FUNCTION sync_auth_login_identifiers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
IF NEW.is_deleted = false AND NEW.status = 'active' THEN
  INSERT INTO auth_login_identifiers (identifier_type, identifier, tenant_id, user_id, is_active)
  VALUES
    ('email', NEW.email::citext, NEW.tenant_id, NEW.id, true),
    ('username', NEW.username::citext, NEW.tenant_id, NEW.id, true)
  ON CONFLICT (identifier_type, identifier, tenant_id) DO UPDATE
    SET user_id = EXCLUDED.user_id,
        is_active = true;
ELSE
  UPDATE auth_login_identifiers
  SET is_active = false
  WHERE user_id = NEW.id;
END IF;

RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_auth_login_identifiers ON users;

CREATE TRIGGER trg_sync_auth_login_identifiers
AFTER INSERT OR UPDATE OF username, email, status, is_deleted ON users
FOR EACH ROW
EXECUTE FUNCTION sync_auth_login_identifiers();

-- Backfill all users that were created after migration 0003.
INSERT INTO auth_login_identifiers (identifier_type, identifier, tenant_id, user_id, is_active)
SELECT 'email', email::citext, tenant_id, id, true
FROM users
WHERE is_deleted = false AND status = 'active'
ON CONFLICT (identifier_type, identifier, tenant_id) DO UPDATE
  SET user_id = EXCLUDED.user_id,
      is_active = true;

INSERT INTO auth_login_identifiers (identifier_type, identifier, tenant_id, user_id, is_active)
SELECT 'username', username::citext, tenant_id, id, true
FROM users
WHERE is_deleted = false AND status = 'active'
ON CONFLICT (identifier_type, identifier, tenant_id) DO UPDATE
  SET user_id = EXCLUDED.user_id,
      is_active = true;
