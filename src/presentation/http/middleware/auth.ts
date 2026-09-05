import type { FastifyReply, FastifyRequest } from 'fastify';

import type { AuthenticatedUser } from '../../../domain/contracts/authentication.js';
import { ForbiddenError, UnauthorizedError } from '../../../domain/errors.js';
import type { AuthenticationService } from '../../../application/services/authentication-service.js';
import type { AuthorizationService } from '../../../application/services/authorization-service.js';
import type { CoreEnterpriseService } from '../../../application/services/core-enterprise-service.js';
import type { LocationService } from '../../../application/services/location-service.js';
import type { ModuleAccessService } from '../../../application/services/module-access-service.js';
import type { TenantMembershipService } from '../../../application/services/tenant-membership-service.js';
import type { UserRegistrationService } from '../../../application/services/user-registration-service.js';
import type { AccountSecurityService } from '../../../application/services/account-security-service.js';
import type { MfaService } from '../../../application/services/mfa-service.js';
import type { CustomerService } from '../../../application/services/customer-service.js';
import type { QuotationService } from '../../../application/services/quotation-service.js';
import type { OrderService } from '../../../application/services/order-service.js';
import type { DeliveryService } from '../../../application/services/delivery-service.js';
import type { InvoiceService } from '../../../application/services/invoice-service.js';
import type { SalesReturnService } from '../../../application/services/sales-return-service.js';
import type { CreditNoteService } from '../../../application/services/credit-note-service.js';
import type { JwtTokenService } from '../../../infrastructure/security/jwt-token-service.js';
import type { AppConfig } from '../../../config/schema.js';
import type { AuditLogger } from '../../../application/contracts/audit.js';

declare module 'fastify' {
  interface FastifyInstance {
    appConfig: AppConfig;
    dbPool: import('pg').Pool;
    authService: AuthenticationService;
    authorizationService: AuthorizationService;
    branchService: import('../../../application/services/branch-service.js').BranchService;
    coreEnterpriseService: CoreEnterpriseService;
    locationService: LocationService;
    moduleAccessService: ModuleAccessService;
    registrationService: UserRegistrationService;
    jwtTokenService: JwtTokenService;
    tenantMembershipService: TenantMembershipService;
    accountSecurityService: AccountSecurityService;
    mfaService: MfaService;
    auditLogger: AuditLogger;
    customerService: CustomerService;
    quotationService: QuotationService;
    orderService: OrderService;
    deliveryService: DeliveryService;
    invoiceService: InvoiceService;
    salesReturnService: SalesReturnService;
    creditNoteService: CreditNoteService;
  }

  interface FastifyRequest {
    user?: AuthenticatedUser;
    tenantId?: string;
    sessionId?: string;
  }
}

export function getBearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header || typeof header !== 'string') return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

export async function requireAuth(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const token = getBearerToken(request);
  if (!token) throw new UnauthorizedError('Authentication token is required.');

  const claims = request.server.jwtTokenService.verifyAccessToken(token);
  const session = await request.server.authService.validateSession(claims.sessionId, claims.tenantId);
  if (!session) throw new UnauthorizedError('Session is invalid or expired.');

  request.user = session;
  request.tenantId = session.tenantId;
  request.sessionId = claims.sessionId;
}

export function requireModule(moduleCode: string) {
  return async function requireModuleHandler(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    if (!request.user || !request.tenantId)
      throw new UnauthorizedError('Authentication is required to access a module.');
    if (!request.user.organizationId) throw new ForbiddenError('An active organization is required to access modules.');

    const enabled = await request.server.moduleAccessService.isModuleEnabled(
      request.tenantId,
      request.user.organizationId,
      moduleCode,
    );
    if (!enabled) throw new ForbiddenError('Module access denied.');
  };
}

function moduleCodeForPermission(permissionKey: string): string {
  const prefix = permissionKey.split('.')[0]?.trim() ?? '';
  switch (prefix) {
    case 'tenant':
      return 'tenant-configuration';
    case 'user':
      return 'user-management';
    case 'role':
    case 'permission':
    case 'session':
      return 'security';
    case 'customer':
      return 'crm';
    case 'sales':
      return 'sales';
    default:
      return prefix;
  }
}

export function requirePermission(permissionKey: string) {
  return async function requirePermissionHandler(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    if (!request.user || !request.tenantId)
      throw new UnauthorizedError('Authentication is required to perform this action.');
    if (!request.user.organizationId)
      throw new ForbiddenError('An active organization is required to perform this action.');

    const moduleEnabled = await request.server.moduleAccessService.isModuleEnabled(
      request.tenantId,
      request.user.organizationId,
      moduleCodeForPermission(permissionKey),
    );
    if (!moduleEnabled) throw new ForbiddenError('Module access denied.');

    const allowed = await request.server.authorizationService.hasPermission(
      request.tenantId,
      request.user.id,
      permissionKey,
    );
    if (!allowed) throw new ForbiddenError('Permission denied.');
  };
}

export function requirePermissionOrSelf(
  permissionKey: string,
  selfIdGetter?: (request: FastifyRequest) => string | null | undefined,
) {
  return async function requirePermissionOrSelfHandler(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    if (!request.user || !request.tenantId)
      throw new UnauthorizedError('Authentication is required to perform this action.');

    const resolvedSelfId = selfIdGetter ? selfIdGetter(request) : null;
    if (resolvedSelfId && request.user.id === resolvedSelfId) return;

    if (!request.user.organizationId)
      throw new ForbiddenError('An active organization is required to perform this action.');

    const moduleEnabled = await request.server.moduleAccessService.isModuleEnabled(
      request.tenantId,
      request.user.organizationId,
      moduleCodeForPermission(permissionKey),
    );
    if (!moduleEnabled) throw new ForbiddenError('Module access denied.');

    const allowed = await request.server.authorizationService.hasPermission(
      request.tenantId,
      request.user.id,
      permissionKey,
    );
    if (!allowed) throw new ForbiddenError('Permission denied.');
  };
}
