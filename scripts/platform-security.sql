-- Run as the database owner, not through the application.
-- Supply passwords through the operator secret manager; do not commit them here.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'erp_app') THEN
    CREATE ROLE erp_app NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'erp_platform_executor') THEN
    CREATE ROLE erp_platform_executor NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'erp_procedure_owner') THEN
    CREATE ROLE erp_procedure_owner NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION NOLOGIN;
  END IF;
END $$;
DO $$
BEGIN
  EXECUTE format(
    'GRANT CONNECT ON DATABASE %I TO erp_app, erp_platform_executor, erp_procedure_owner',
    current_database()
  );
END $$;
GRANT USAGE ON SCHEMA public TO erp_app, erp_platform_executor, erp_procedure_owner;
REVOKE ALL ON FUNCTION platform_update_tenant_status(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION platform_delete_tenant(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform_update_tenant_status(uuid, text) TO erp_platform_executor;
GRANT EXECUTE ON FUNCTION platform_delete_tenant(uuid) TO erp_platform_executor;
