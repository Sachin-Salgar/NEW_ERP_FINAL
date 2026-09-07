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
import type { PricingService } from '../../../application/services/pricing-service.js';
import type { DiscountService } from '../../../application/services/discount-service.js';
import type { SalesReportingService } from '../../../application/services/sales-reporting-service.js';
import type { JwtTokenService } from '../../../infrastructure/security/jwt-token-service.js';
import type { AppConfig } from '../../../config/schema.js';
import type { AuditLogger } from '../../../application/contracts/audit.js';
import type { SecurityAdministrationService } from '../../../application/services/security-administration-service.js';
import type { ItemMasterService } from '../../../application/services/item-master-service.js';
import type { InventoryService } from '../../../application/services/inventory-service.js';
import type { ProcurementService } from '../../../application/services/procurement-service.js';
import type { TaxService } from '../../../application/services/tax-service.js';
import type { TenantAdministrationService } from '../../../application/services/tenant-administration-service.js';
import type { TenantBootstrapService } from '../../../application/services/tenant-bootstrap-service.js';
import type { PlatformAuthorizationService } from '../../../application/services/platform-authorization-service.js';

declare module 'fastify' {
  interface FastifyInstance {
    appConfig: AppConfig;
    dbPool: import('pg').Pool;
    platformDbPool?: import('pg').Pool;
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
    pricingService: PricingService;
    discountService: DiscountService;
    salesReportingService: SalesReportingService;
    itemMasterService: ItemMasterService;
    inventoryService: InventoryService;
    procurementService: ProcurementService;
    taxService: TaxService;
    securityAdministrationService: SecurityAdministrationService;
    tenantAdministrationService: TenantAdministrationService;
    tenantBootstrapService: TenantBootstrapService;
    platformAuthorizationService: PlatformAuthorizationService;
  }
  interface FastifyRequest {
    user?: AuthenticatedUser;
    tenantId?: string;
    sessionId?: string;
    contextType?: 'tenant' | 'platform';
    platformMembershipId?: string;
    identityId?: string;
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
  if (!claims.tenantId || claims.contextType === 'platform')
    throw new UnauthorizedError('A tenant context is required.');
  const session = await request.server.authService.validateSession(claims.sessionId, claims.tenantId);
  if (!session) throw new UnauthorizedError('Session is invalid or expired.');
  request.user = session;
  request.tenantId = session.tenantId;
  request.sessionId = claims.sessionId;
}
export function requirePlatformContext(permissionKey?: string) {
  return async function requirePlatformContextHandler(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const token = getBearerToken(request);
    if (!token) throw new UnauthorizedError('Authentication token is required.');
    const claims = request.server.jwtTokenService.verifyAccessToken(token);
    if (claims.contextType !== 'platform') throw new ForbiddenError('Platform context is required.');
    const context = await request.server.platformAuthorizationService.validateContext(claims.sessionId, claims.sub);
    if (!context) throw new UnauthorizedError('Platform session is invalid or expired.');
    if (
      permissionKey &&
      !(await request.server.platformAuthorizationService.hasPermission(context.platformMembershipId, permissionKey))
    )
      throw new ForbiddenError('Platform permission denied.');
    request.contextType = 'platform';
    request.sessionId = context.sessionId;
    request.identityId = context.identityId;
    request.platformMembershipId = context.platformMembershipId;
  };
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
    case 'role_permission':
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
