-- Identity-based tenant discovery.
-- This table is a deployment-independent login index only. It contains no password
-- and grants no authorization. The authoritative account remains users(tenant_id, id).
CREATE TABLE IF NOT EXISTS auth_login_identifiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier CITEXT NOT NULL UNIQUE,
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ,
    CONSTRAINT fk_auth_login_user_tenant
        FOREIGN KEY (user_id, tenant_id)
        REFERENCES users(id, tenant_id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_auth_login_identifiers_tenant_user
    ON auth_login_identifiers (tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_auth_login_identifiers_active
    ON auth_login_identifiers (identifier) WHERE is_active = true;

-- Backfill the canonical email login for existing active users.
INSERT INTO auth_login_identifiers (identifier, tenant_id, user_id, is_active)
SELECT email, tenant_id, id, true
FROM users
WHERE is_deleted = false AND status = 'active'
ON CONFLICT (identifier) DO UPDATE
SET tenant_id = EXCLUDED.tenant_id,
    user_id = EXCLUDED.user_id,
    is_active = EXCLUDED.is_active,
    updated_at = now();

-- Keep the lookup index synchronized for the canonical email identity.
CREATE OR REPLACE FUNCTION sync_auth_login_identifier()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        DELETE FROM auth_login_identifiers WHERE tenant_id = OLD.tenant_id AND user_id = OLD.id;
        RETURN OLD;
    END IF;

    IF NEW.is_deleted = true OR NEW.status <> 'active' THEN
        UPDATE auth_login_identifiers
        SET is_active = false, updated_at = now()
        WHERE tenant_id = NEW.tenant_id AND user_id = NEW.id;
        RETURN NEW;
    END IF;

    INSERT INTO auth_login_identifiers (identifier, tenant_id, user_id, is_active)
    VALUES (NEW.email, NEW.tenant_id, NEW.id, true)
    ON CONFLICT (identifier) DO UPDATE
    SET tenant_id = EXCLUDED.tenant_id,
        user_id = EXCLUDED.user_id,
        is_active = true,
        updated_at = now();

    UPDATE auth_login_identifiers
    SET is_active = false, updated_at = now()
    WHERE tenant_id = NEW.tenant_id
      AND user_id = NEW.id
      AND identifier <> NEW.email;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_auth_login_identifier ON users;
CREATE TRIGGER trg_sync_auth_login_identifier
AFTER INSERT OR UPDATE OF email, tenant_id, status, is_deleted ON users
FOR EACH ROW
EXECUTE FUNCTION sync_auth_login_identifier();
