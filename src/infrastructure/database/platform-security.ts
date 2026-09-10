import { readFile } from 'node:fs/promises';
import type { Client, Pool } from 'pg';

type Queryable = Pick<Client | Pool, 'query'>;

export async function runPlatformSecurityBootstrap(
  client: Client,
  options?: { requireErp?: boolean },
  verify: (database: Queryable, options?: { requireErp?: boolean }) => Promise<void> = verifyPlatformSecurity,
): Promise<void> {
  await client.query('BEGIN');
  try {
    const sql = await readFile(new URL('../../../scripts/platform-security.sql', import.meta.url), 'utf8');
    await client.query(sql);
    await verify(client, options);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

const lifecycleFunctions = [
  'public.platform_update_tenant_status(uuid,text)',
  'public.platform_delete_tenant(uuid)',
] as const;

export async function verifyPlatformSecurity(
  database: Queryable,
  options?: { requireErp?: boolean },
): Promise<void> {
  const requireErp = options?.requireErp ?? false;
  const expectedRoleCount = requireErp ? 4 : 3;
  const roles = await database.query<{
    rolname: string;
    rolcanlogin: boolean;
    rolsuper: boolean;
    rolcreatedb: boolean;
    rolcreaterole: boolean;
    rolreplication: boolean;
    rolbypassrls: boolean;
  }>(
    `SELECT rolname, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls
     FROM pg_roles
     WHERE rolname = ANY($1::text[])`,
    [requireErp ? ['erp', 'erp_app', 'erp_procedure_owner', 'erp_platform_executor'] : ['erp_app', 'erp_procedure_owner', 'erp_platform_executor']],
  );
  const roleByName = new Map(roles.rows.map((role) => [role.rolname, role]));
  if (roles.rows.length !== expectedRoleCount) throw new Error('Platform security roles are incomplete.');

  const owner = roleByName.get('erp_procedure_owner');
  const executor = roleByName.get('erp_platform_executor');
  const erp = roleByName.get('erp');
  const erpApp = roleByName.get('erp_app');
  if (!owner || owner.rolcanlogin || owner.rolsuper || owner.rolcreatedb || owner.rolcreaterole || owner.rolreplication || owner.rolbypassrls) {
    throw new Error('erp_procedure_owner role attributes are not hardened.');
  }
  if (
    !executor ||
    !executor.rolcanlogin ||
    executor.rolsuper ||
    executor.rolcreatedb ||
    executor.rolcreaterole ||
    executor.rolreplication ||
    executor.rolbypassrls
  ) {
    throw new Error('erp_platform_executor role attributes are not hardened.');
  }
  if (
    requireErp &&
    (!erp ||
     !erp.rolcanlogin ||
     erp.rolsuper ||
     erp.rolcreatedb ||
     !erp.rolcreaterole ||
     erp.rolreplication ||
     erp.rolbypassrls)
  ) {
    throw new Error('erp migration role attributes are not compatible with the production contract.');
  }
  if (
    !erpApp ||
    !erpApp.rolcanlogin ||
    erpApp.rolsuper ||
    erpApp.rolcreatedb ||
    erpApp.rolcreaterole ||
    erpApp.rolreplication ||
    erpApp.rolbypassrls
  ) {
    throw new Error('erp_app role attributes are not hardened.');
  }

  const memberships = await database.query(
    `SELECT 1
     FROM pg_auth_members memberships
     JOIN pg_roles granted ON granted.oid = memberships.roleid
     JOIN pg_roles member ON member.oid = memberships.member
     WHERE granted.rolname IN ('erp_procedure_owner', 'erp_platform_executor')
        OR member.rolname IN ('erp', 'erp_app', 'erp_procedure_owner', 'erp_platform_executor')`,
  );
  if (memberships.rowCount !== 0) throw new Error('Platform roles retain unintended memberships.');

  const functionSecurity = await database.query<{
    owner: string;
    prosecdef: boolean;
    proconfig: string[] | null;
    erp_allowed: boolean;
    erp_app_allowed: boolean;
    executor_allowed: boolean;
    public_allowed: boolean;
  }>(
    `SELECT pg_get_userbyid(p.proowner) AS owner,
            p.prosecdef,
            p.proconfig,
            CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'erp')
              THEN has_function_privilege('erp', p.oid, 'EXECUTE')
              ELSE false END AS erp_allowed,
            has_function_privilege('erp_app', p.oid, 'EXECUTE') AS erp_app_allowed,
            has_function_privilege('erp_platform_executor', p.oid, 'EXECUTE') AS executor_allowed,
            has_function_privilege('public', p.oid, 'EXECUTE') AS public_allowed
     FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE p.oid = ANY($1::regprocedure[])
     ORDER BY p.oid`,
    [lifecycleFunctions],
  );
  if (functionSecurity.rows.length !== lifecycleFunctions.length) {
    throw new Error('Platform lifecycle functions are incomplete.');
  }
  for (const fn of functionSecurity.rows) {
    if (
      fn.owner !== 'erp_procedure_owner' ||
      !fn.prosecdef ||
      JSON.stringify(fn.proconfig) !== JSON.stringify(['search_path=pg_catalog, public']) ||
      fn.erp_allowed ||
      fn.erp_app_allowed ||
      !fn.executor_allowed ||
      fn.public_allowed
    ) {
      throw new Error('Platform lifecycle function security invariants failed.');
    }
  }
  const unintendedFunctionGrants = await database.query(
    `SELECT p.oid::regprocedure AS function_name, grantee.rolname AS grantee
     FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
     CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) privilege
     LEFT JOIN pg_roles grantee ON grantee.oid = privilege.grantee
     WHERE p.oid = ANY($1::regprocedure[])
       AND privilege.privilege_type = 'EXECUTE'
       AND privilege.grantee <> 0
       AND COALESCE(grantee.rolname, '') NOT IN ('erp_procedure_owner', 'erp_platform_executor')`,
    [lifecycleFunctions],
  );
  if (unintendedFunctionGrants.rowCount !== 0) {
    throw new Error('Platform lifecycle functions retain unintended role EXECUTE grants.');
  }
  const defaultFunctionGrants = await database.query(
    `SELECT 1
     FROM pg_default_acl defaults
    JOIN pg_roles owner ON owner.oid = defaults.defaclrole
    CROSS JOIN LATERAL aclexplode(defaults.defaclacl) privilege
     WHERE defaults.defaclnamespace = 'public'::regnamespace
      AND owner.rolname = 'erp'
      AND defaults.defaclobjtype IN ('r', 'S', 'f')`,
  );
  if (defaultFunctionGrants.rowCount !== 0) {
   throw new Error('Default privileges for erp and erp_app are not hardened.');
  }

  const privileges = await database.query<{
   database_connect: boolean;
   app_database_connect: boolean;
   executor_database_connect: boolean;
   owner_database_connect: boolean;
   app_usage: boolean;
   executor_usage: boolean;
   owner_usage: boolean;
   app_create: boolean;
   executor_create: boolean;
   owner_create: boolean;
   executor_table_access: boolean;
   executor_sequence_access: boolean;
   owner_sequence_access: boolean;
   app_relation_ownership: boolean;
   app_function_ownership: boolean;
  }>(
   `SELECT CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'erp')
             THEN has_database_privilege('erp', current_database(), 'CONNECT')
             ELSE true END AS database_connect,
           has_database_privilege('erp_app', current_database(), 'CONNECT') AS app_database_connect,
           has_database_privilege('erp_platform_executor', current_database(), 'CONNECT') AS executor_database_connect,
           has_database_privilege('erp_procedure_owner', current_database(), 'CONNECT') AS owner_database_connect,
           has_schema_privilege('erp_app', 'public', 'USAGE') AS app_usage,
           has_schema_privilege('erp_platform_executor', 'public', 'USAGE') AS executor_usage,
           has_schema_privilege('erp_procedure_owner', 'public', 'USAGE') AS owner_usage,
           has_schema_privilege('erp_app', 'public', 'CREATE') AS app_create,
           has_schema_privilege('erp_platform_executor', 'public', 'CREATE') AS executor_create,
           has_schema_privilege('erp_procedure_owner', 'public', 'CREATE') AS owner_create,
           EXISTS (
             SELECT 1 FROM information_schema.role_table_grants
             WHERE grantee = 'erp_platform_executor'
            ) AS executor_table_access,
            EXISTS (
             SELECT 1 FROM information_schema.role_usage_grants
             WHERE grantee = 'erp_platform_executor'
               AND object_type = 'SEQUENCE'
            ) AS executor_sequence_access,
            EXISTS (
             SELECT 1 FROM information_schema.role_usage_grants
             WHERE grantee = 'erp_procedure_owner'
               AND object_type = 'SEQUENCE'
            ) AS owner_sequence_access,
            EXISTS (
             SELECT 1 FROM pg_class
             WHERE relnamespace = 'public'::regnamespace
               AND relowner = (SELECT oid FROM pg_roles WHERE rolname = 'erp_app')
            ) AS app_relation_ownership,
            EXISTS (
             SELECT 1 FROM pg_proc
             WHERE pronamespace = 'public'::regnamespace
               AND proowner = (SELECT oid FROM pg_roles WHERE rolname = 'erp_app')
            ) AS app_function_ownership`,
  );
  const privilegeRow = privileges.rows[0];
  if (
    !privilegeRow.database_connect ||
    !privilegeRow.app_database_connect ||
    !privilegeRow.executor_database_connect ||
    !privilegeRow.owner_database_connect ||
    !privilegeRow.app_usage ||
    !privilegeRow.executor_usage ||
    !privilegeRow.owner_usage ||
    privilegeRow.app_create ||
    privilegeRow.executor_create ||
    privilegeRow.owner_create ||
    privilegeRow.executor_table_access ||
    privilegeRow.executor_sequence_access ||
    privilegeRow.owner_sequence_access ||
    privilegeRow.app_relation_ownership ||
    privilegeRow.app_function_ownership
  ) {
    throw new Error('Platform database, schema, or dedicated-role privileges are too broad.');
  }
  const appTablePrivileges = await database.query(
    `SELECT privilege_type
     FROM information_schema.role_table_grants
     WHERE grantee = 'erp_app'
       AND privilege_type NOT IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')`,
  );
  if (appTablePrivileges.rowCount !== 0) {
    throw new Error('erp_app retains an unexpected table privilege.');
  }
  const appSequencePrivileges = await database.query(
    `SELECT privilege_type
     FROM information_schema.role_usage_grants
     WHERE grantee = 'erp_app'
       AND object_type = 'SEQUENCE'
       AND privilege_type NOT IN ('USAGE', 'SELECT', 'UPDATE')`,
  );
  if (appSequencePrivileges.rowCount !== 0) {
    throw new Error('erp_app retains an unexpected sequence privilege.');
  }
  const ownerTables = await database.query<{ table_name: string; privilege_type: string }>(
    `SELECT table_name, privilege_type
     FROM information_schema.role_table_grants
     WHERE grantee = 'erp_procedure_owner'
     ORDER BY table_name, privilege_type`,
  );
  const expectedOwnerTables = [
    'audit_events:SELECT',
    'branches:SELECT',
    'tenants:SELECT',
    'tenants:UPDATE',
    'users:SELECT',
  ];
  if (ownerTables.rows.map((row) => `${row.table_name}:${row.privilege_type}`).join('|') !== expectedOwnerTables.join('|')) {
    throw new Error('Procedure-owner table privileges are not minimal.');
  }
  const sequencePrivileges = await database.query(
    `SELECT 1
     FROM information_schema.role_usage_grants
     WHERE grantee IN ('erp_platform_executor', 'erp_procedure_owner')
       AND object_type = 'SEQUENCE'`,
  );
  if (sequencePrivileges.rowCount !== 0) throw new Error('Dedicated platform roles retain sequence privileges.');
  const ownership = await database.query(
    `SELECT 1
     FROM pg_database
     WHERE datdba IN (
       SELECT oid FROM pg_roles WHERE rolname IN ('erp_procedure_owner', 'erp_platform_executor')
     )
     UNION ALL
     SELECT 1
     FROM pg_namespace
     WHERE nspowner IN (
         SELECT oid FROM pg_roles WHERE rolname IN ('erp_procedure_owner', 'erp_platform_executor')
       )
     UNION ALL
     SELECT 1
     FROM pg_class
     WHERE relowner IN (
       SELECT oid FROM pg_roles WHERE rolname IN ('erp_procedure_owner', 'erp_platform_executor')
     )
     UNION ALL
     SELECT 1
     FROM pg_proc
     WHERE proowner = (SELECT oid FROM pg_roles WHERE rolname = 'erp_platform_executor')
        OR (
          proowner = (SELECT oid FROM pg_roles WHERE rolname = 'erp_procedure_owner')
          AND oid <> ALL($1::regprocedure[])
        )
     UNION ALL
     SELECT 1
     FROM pg_database
     WHERE datdba = (SELECT oid FROM pg_roles WHERE rolname = 'erp_app')
     UNION ALL
     SELECT 1
     FROM pg_namespace
     WHERE nspname = 'public'
       AND nspowner = (SELECT oid FROM pg_roles WHERE rolname = 'erp_app')`,
    [lifecycleFunctions],
  );
  if (ownership.rowCount !== 0) throw new Error('Dedicated platform roles own database or schema objects.');

  const rls = await database.query<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>(
    `SELECT relname, relrowsecurity, relforcerowsecurity
     FROM pg_class
     WHERE relnamespace = 'public'::regnamespace
       AND relname = ANY($1::text[])`,
    [['users', 'branches', 'audit_events']],
  );
  if (
    rls.rows.length !== 3 ||
    rls.rows.some((table) => !table.relrowsecurity || !table.relforcerowsecurity)
  ) {
    throw new Error('Tenant FORCE RLS invariants failed.');
  }
}
