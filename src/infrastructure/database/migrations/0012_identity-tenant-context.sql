-- Identity-based tenant discovery.
-- This table is a deployment-independent login index only. It contains no password
-- and grants no authorization. The authoritative account remains users(tenant_id, id).
CREATE TABLE IF NOT EXISTS auth_login_identifiers (
    login_identifier CITEXT PRIMARY KEY,
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_auth_login_user_tenant
        FOREIGN KEY (user_id, tenant_id)
        REFERENCES users(id, tenant_id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_auth_login_identifiers_tenant_user
    ON auth_login_identifiers (tenant_id, user_id);

-- Backfill the canonical email login for existing active users.
INSERT INTO auth_login_identifiers (login_identifier, tenant_id, user_id)
SELECT email, tenant_id, id
FROM users
WHERE is_deleted = false
ON CONFLICT (login_identifier) DO UPDATE
SET tenant_id = EXCLUDED.tenant_id,
    user_id = EXCLUDED.user_id;

-- Keep the lookup index synchronized for normal user lifecycle changes.
CREATE OR REPLACE FUNCTION sync_auth_login_identifier()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' OR NEW.is_deleted = true OR NEW.status <> 'active' THEN
        DELETE FROM auth_login_identifiers
        WHERE tenant_id = OLD.tenant_id AND user_id = OLD.id;
        RETURN NEW;
    END IF;

    INSERT INTO auth_login_identifiers (login_identifier, tenant_id, user_id)
    VALUES (NEW.email, NEW.tenant_id, NEW.id)
    ON CONFLICT (login_identifier) DO UPDATE
    SET tenant_id = EXCLUDED.tenant_id,
        user_id = EXCLUDED.user_id;

    DELETE FROM auth_login_identifiers
    WHERE tenant_id = NEW.tenant_id
      AND user_id = NEW.id
      AND login_identifier <> NEW.email;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_auth_login_identifier ON users;
CREATE TRIGGER trg_sync_auth_login_identifier
AFTER INSERT OR UPDATE OF email, tenant_id, status, is_deleted ON users
FOR EACH ROW
EXECUTE FUNCTION sync_auth_login_identifier();
