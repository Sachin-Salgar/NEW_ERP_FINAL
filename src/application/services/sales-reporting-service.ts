import { validate as isUuid } from 'uuid';
import type { AuthorizationService } from './authorization-service.js';
import type { ModuleAccessService } from './module-access-service.js';
import type {
  SalesDocumentSummary,
  SalesReportContext,
  SalesReportRepository,
} from '../../domain/contracts/sales-reporting.js';
import { SALES_REPORTING_PERMISSIONS } from '../../domain/contracts/sales-reporting.js';
import { ForbiddenError, UnauthorizedError, ValidationError } from '../../domain/errors.js';

export class SalesReportingService {
  constructor(
    private readonly repository: SalesReportRepository,
    private readonly authorization: Pick<AuthorizationService, 'hasPermission'>,
    private readonly modules: Pick<ModuleAccessService, 'isModuleEnabled'>,
  ) {}

  async listDocumentSummary(
    context: SalesReportContext,
    input: { page: number; pageSize: number; order: 'asc' | 'desc'; search?: string },
  ): Promise<{ items: SalesDocumentSummary[]; total: number }> {
    await this.authorize(context);
    if (!Number.isInteger(input.page) || input.page < 1 || !Number.isInteger(input.pageSize) || input.pageSize < 1 || input.pageSize > 100) {
      throw new ValidationError('Page must be positive and page size must be between 1 and 100.');
    }
    return this.repository.listDocumentSummary(context, input);
  }

  private async authorize(context: SalesReportContext): Promise<void> {
    if (!context.userId?.trim()) throw new UnauthorizedError();
    for (const [value, label] of [
      [context.tenantId, 'Tenant ID'],
      [context.organizationId, 'Organization ID'],
      [context.branchId, 'Branch ID'],
      [context.financialYearId, 'Financial Year ID'],
      [context.userId, 'User ID'],
    ] as const) {
      if (!isUuid(value)) throw new ValidationError(`${label} must be a valid UUID.`);
    }
    if (!(await this.modules.isModuleEnabled(context.tenantId, context.organizationId, 'sales'))) {
      throw new ForbiddenError('Sales module is not enabled.');
    }
    if (!(await this.authorization.hasPermission(context.tenantId, context.userId, SALES_REPORTING_PERMISSIONS.read))) {
      throw new ForbiddenError('Insufficient Sales reporting permission.');
    }
  }
}
