import { validate as isUuid } from 'uuid';

import type { AuditQuery, AuditQueryResult, AuditRepository } from '../contracts/audit.js';
import type { AuthorizationService } from './authorization-service.js';
import type { ModuleAccessService } from './module-access-service.js';
import { ForbiddenError, ValidationError } from '../../domain/errors.js';

export interface AuditQueryContext {
  tenantId: string;
  userId: string;
}

export class AuditQueryService {
  constructor(
    private readonly repository: AuditRepository,
    private readonly authorizationService: Pick<AuthorizationService, 'hasPermission'>,
    private readonly moduleAccessService: Pick<ModuleAccessService, 'isModuleEnabled'>,
  ) {}

  async list(context: AuditQueryContext, query: AuditQuery): Promise<AuditQueryResult> {
    this.validateContext(context);
    await this.authorize(context);
    this.validateQuery(query);
    return this.repository.list(context.tenantId, query);
  }

  private async authorize(context: AuditQueryContext): Promise<void> {
    if (!(await this.moduleAccessService.isModuleEnabled(context.tenantId, 'security'))) {
      throw new ForbiddenError('Security module is not enabled.');
    }
    if (!(await this.authorizationService.hasPermission(context.tenantId, context.userId, 'security.audit_log.read'))) {
      throw new ForbiddenError('Permission denied.');
    }
  }

  private validateContext(context: AuditQueryContext): void {
    if (!isUuid(context.tenantId) || !isUuid(context.userId)) {
      throw new ValidationError('A valid tenant and user context is required.');
    }
  }

  private validateQuery(query: AuditQuery): void {
    if (!Number.isInteger(query.page) || query.page < 1) {
      throw new ValidationError('page must be a positive integer.');
    }
    if (!Number.isInteger(query.pageSize) || query.pageSize < 1 || query.pageSize > 100) {
      throw new ValidationError('page_size must be between 1 and 100.');
    }
    if (query.from && query.to && query.from > query.to) {
      throw new ValidationError('from must be earlier than or equal to to.');
    }
  }
}
