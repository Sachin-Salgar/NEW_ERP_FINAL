import { randomBytes } from 'node:crypto';
import { v7 as uuidV7 } from 'uuid';
import type { Pool } from 'pg';
import { NotFoundError, ValidationError } from '../../domain/errors.js';
import { withTenantContext } from '../../infrastructure/database/tenant-context.js';
import type { PasswordHasher } from '../contracts/security.js';

export type EmployeeAccessAction = 'GRANT' | 'SUSPEND' | 'REVOKE' | 'RESTORE';

export interface ProvisionedEmployeeAccess {
  employeeId: string;
  userId: string;
  identityId: string;
  membershipId: string;
  username: string;
  email: string;
  status: string;
}

export class IdentityProvisioningService {
  constructor(
    private readonly pool: Pool,
    private readonly tenantContextKey: string,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async provisionEmployeeAccess(
    tenantId: string,
    employeeId: string,
    actorUserId: string,
    input: { username?: string; email?: string; defaultBranchId?: string | null },
  ): Promise<ProvisionedEmployeeAccess> {
    return withTenantContext(this.pool, this.tenantContextKey, tenantId, async client => {
      const employee = (await client.query(
          `SELECT id, employee_no, first_name, last_name, work_email, email, user_id, identity_id, employment_status
             FROM hr_employees WHERE tenant_id=$1 AND id=$2 AND is_deleted=false FOR UPDATE`,
          [tenantId, employeeId],
        )).rows[0];
        if (!employee) throw new NotFoundError('Employee not found.');
        if (employee.employment_status === 'EXITED') throw new ValidationError('Exited employees cannot receive ERP access.');
        if (employee.user_id || employee.identity_id) throw new ValidationError('Employee already has ERP access mapping.');

        const username = (input.username ?? employee.employee_no ?? `${employee.first_name ?? ''}.${employee.last_name ?? ''}`).trim().toLowerCase();
        const email = (input.email ?? employee.work_email ?? employee.email ?? '').trim().toLowerCase();
        if (!username || !email) throw new ValidationError('A username and email are required for ERP access.');
        const duplicate = await client.query(
          `SELECT 1 FROM users WHERE tenant_id=$1 AND (lower(username)=lower($2) OR lower(email)=lower($3)) AND is_deleted=false LIMIT 1`,
          [tenantId, username, email],
        );
        if (duplicate.rowCount) throw new ValidationError('A tenant ERP user already exists with that username or email.');

        const identityId = uuidV7();
        const userId = uuidV7();
        const membershipId = uuidV7();
        const temporaryPassword = randomBytes(32).toString('base64url');
        const passwordHash = await this.passwordHasher.hash(temporaryPassword);

        await client.query(
          `INSERT INTO identities(id,status,created_at,updated_at) VALUES($1,'active',NOW(),NOW())`,
          [identityId],
        );
        await client.query(
          `INSERT INTO identity_credentials(identity_id,provider,credential_type,secret_hash,password_changed_at,status)
           VALUES($1,'local','password',$2,NULL,'active')`,
          [identityId, passwordHash],
        );
        await client.query(
          `INSERT INTO tenant_memberships(id,identity_id,tenant_id,status,activated_at)
           VALUES($1,$2,$3,'active',NOW())`,
          [membershipId, identityId, tenantId],
        );
        await client.query(
          `INSERT INTO users(id,tenant_id,identity_id,default_branch_id,username,email,password_hash,status,password_changed_at,created_at,updated_at,is_deleted,version)
           VALUES($1,$2,$3,$4,$5,$6,$7,'active',NULL,NOW(),NOW(),false,1)`,
          [userId,tenantId,identityId,input.defaultBranchId ?? null,username,email,passwordHash],
        );
        await client.query(
          `INSERT INTO auth_login_identifiers(identifier_type,identifier,tenant_id,user_id,identity_id,is_active)
           VALUES('email',$1::citext,$2,$3,$4,true),('username',$5::citext,$2,$3,$4,true)
           ON CONFLICT(identifier_type,identifier) DO UPDATE
             SET tenant_id=EXCLUDED.tenant_id,user_id=EXCLUDED.user_id,identity_id=EXCLUDED.identity_id,is_active=true`,
          [email,tenantId,userId,identityId,username],
        );
        if (input.defaultBranchId) {
          const branch = await client.query(
            `SELECT id FROM branches WHERE tenant_id=$1 AND id=$2 AND status='active' AND is_deleted=false LIMIT 1`,
            [tenantId,input.defaultBranchId],
          );
          if (!branch.rowCount) throw new ValidationError('Default branch is not an active tenant branch.');
          await client.query(
            `INSERT INTO user_branch_access(tenant_id,user_id,branch_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,
            [tenantId,userId,input.defaultBranchId],
          );
        }
        await client.query(
          `UPDATE hr_employees SET user_id=$1, identity_id=$2, updated_at=NOW(), version=version+1 WHERE tenant_id=$3 AND id=$4`,
          [userId,identityId,tenantId,employeeId],
        );
        await client.query(
          `INSERT INTO hr_access_history(id,tenant_id,employee_id,user_id,action,reason,changed_by) VALUES($1,$2,$3,$4,'GRANT','ERP access provisioned',$5)`,
          [uuidV7(),tenantId,employeeId,userId,actorUserId],
        );
      return { employeeId,userId,identityId,membershipId,username,email,status:'active' };
    });
  }

  async changeEmployeeAccess(
    tenantId: string,
    employeeId: string,
    actorUserId: string,
    action: Exclude<EmployeeAccessAction,'GRANT'>,
    reason?: string,
  ): Promise<ProvisionedEmployeeAccess> {
    return withTenantContext(this.pool, this.tenantContextKey, tenantId, async client => {
      const row = (await client.query(
          `SELECT e.id employee_id,e.user_id,e.identity_id,u.username,u.email,u.status,i.status identity_status,tm.id membership_id
           FROM hr_employees e
           LEFT JOIN users u ON u.id=e.user_id AND u.tenant_id=e.tenant_id
           LEFT JOIN identities i ON i.id=e.identity_id
           LEFT JOIN tenant_memberships tm ON tm.identity_id=e.identity_id AND tm.tenant_id=e.tenant_id
           WHERE e.tenant_id=$1 AND e.id=$2 AND e.is_deleted=false FOR UPDATE`,
          [tenantId,employeeId],
        )).rows[0];
        if (!row?.user_id || !row?.identity_id || !row?.membership_id) throw new ValidationError('Employee has no ERP access mapping.');

        const active = action === 'RESTORE';
        if (action === 'REVOKE' || action === 'SUSPEND') {
          await client.query(`UPDATE users SET status='inactive',updated_at=NOW(),version=version+1 WHERE tenant_id=$1 AND id=$2`,[tenantId,row.user_id]);
          await client.query(`UPDATE identities SET status='disabled',updated_at=NOW() WHERE id=$1`,[row.identity_id]);
          await client.query(`UPDATE tenant_memberships SET status='revoked',revoked_at=NOW(),updated_at=NOW() WHERE id=$1 AND tenant_id=$2`,[row.membership_id,tenantId]);
          await client.query(`UPDATE auth_login_identifiers SET is_active=false WHERE tenant_id=$1 AND user_id=$2`,[tenantId,row.user_id]);
          await client.query(`UPDATE user_sessions SET is_active=false,revoked_at=COALESCE(revoked_at,NOW()),logout_at=COALESCE(logout_at,NOW()),termination_reason=$3,updated_at=NOW(),version=version+1 WHERE tenant_id=$1 AND user_id=$2 AND is_active=true`,[tenantId,row.user_id,`employee_access_${action.toLowerCase()}`]);
        } else if (active) {
          await client.query(`UPDATE users SET status='active',updated_at=NOW(),version=version+1 WHERE tenant_id=$1 AND id=$2`,[tenantId,row.user_id]);
          await client.query(`UPDATE identities SET status='active',updated_at=NOW() WHERE id=$1`,[row.identity_id]);
          await client.query(`UPDATE tenant_memberships SET status='active',revoked_at=NULL,suspended_at=NULL,activated_at=COALESCE(activated_at,NOW()),updated_at=NOW() WHERE id=$1 AND tenant_id=$2`,[row.membership_id,tenantId]);
          await client.query(`UPDATE auth_login_identifiers SET is_active=true WHERE tenant_id=$1 AND user_id=$2`,[tenantId,row.user_id]);
        }
        await client.query(
          `INSERT INTO hr_access_history(id,tenant_id,employee_id,user_id,action,reason,changed_by) VALUES($1,$2,$3,$4,$5,$6,$7)`,
          [uuidV7(),tenantId,employeeId,row.user_id,action,reason ?? null,actorUserId],
        );
      return { employeeId,userId:row.user_id,identityId:row.identity_id,membershipId:row.membership_id,username:row.username,email:row.email,status:active?'active':'inactive' };
    });
  }
}
