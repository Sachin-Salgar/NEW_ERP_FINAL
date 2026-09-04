import { v7 as uuidV7 } from 'uuid';

import { UnauthorizedError, ValidationError } from '../../domain/errors.js';
import { DEFAULT_PASSWORD_POLICY, type PasswordPolicy, validatePassword } from '../../infrastructure/security/password-policy.js';
import type { PasswordHasher, UserRegistrationInput, UserRegistrationRepository, UserRegistrationRecord } from '../contracts/security.js';
import type { TransactionRunner } from '../contracts/transaction.js';

export class UserRegistrationService {
  constructor(
    private readonly repository: UserRegistrationRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly passwordPolicy: PasswordPolicy = DEFAULT_PASSWORD_POLICY,
    private readonly transactionRunner?: TransactionRunner,
  ) {}

  async registerUser(tenantId: string, actorUserId: string, input: UserRegistrationInput): Promise<UserRegistrationRecord> {
    if (!tenantId || !actorUserId) {
      throw new UnauthorizedError('Tenant context is required for registration.');
    }

    const actor = await this.repository.findById(tenantId, actorUserId);
    if (!actor) {
      throw new UnauthorizedError('Authenticated tenant administrator is required for registration.');
    }

    const username = input.username?.trim();
    const email = input.email?.trim().toLowerCase();
    const password = input.password ?? '';

    if (!username || !email || !password) {
      throw new ValidationError('Username, email, and password are required.');
    }

    const existingUser = await this.repository.findByTenantAndIdentifier(tenantId, username) ?? await this.repository.findByTenantAndIdentifier(tenantId, email);
    if (existingUser) {
      throw new ValidationError('A user with that username or email already exists in this tenant.');
    }

    const passwordIssues = validatePassword(password, this.passwordPolicy);
    if (passwordIssues.length > 0) {
      throw new ValidationError(passwordIssues.join(' '));
    }

    const defaultRoleCode = input.roleCode ?? 'member';
    const targetOrganizationId = input.organizationId ?? actor.organizationId ?? null;
    const passwordHash = await this.passwordHasher.hash(password);

    const register = async (): Promise<UserRegistrationRecord> => {
      let role = await this.repository.findRoleByTenantAndCode(tenantId, defaultRoleCode);
      if (!role) {
        role = await this.repository.createRole(tenantId, defaultRoleCode, defaultRoleCode === 'admin' ? 'Administrator' : 'Member');
      }

      const user = await this.repository.createUser({
        id: uuidV7(),
        tenantId,
        organizationId: targetOrganizationId,
        defaultBranchId: input.defaultBranchId ?? actor.defaultBranchId ?? null,
        username,
        email,
        passwordHash,
        status: 'active',
      });

      if (targetOrganizationId) {
        await this.repository.assignUserToOrganization(tenantId, user.id, targetOrganizationId);
      }
      await this.repository.assignUserRole(tenantId, user.id, role.id);

      return {
        id: user.id,
        tenantId: user.tenantId,
        organizationId: user.organizationId,
        defaultBranchId: user.defaultBranchId,
        username: user.username,
        email: user.email,
        status: user.status,
      };
    };

    return this.transactionRunner ? this.transactionRunner.runInTransaction(register) : register();
  }
}
