import { type Pool } from 'pg';
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';

import { isCorsOriginAllowed, type AppConfig } from '../../config/schema.js';
import { AuthenticationService } from '../../application/services/authentication-service.js';
import { AuthorizationService } from '../../application/services/authorization-service.js';
import { BranchService } from '../../application/services/branch-service.js';
import { CoreEnterpriseService } from '../../application/services/core-enterprise-service.js';
import { LocationService } from '../../application/services/location-service.js';
import { ModuleAccessService } from '../../application/services/module-access-service.js';
import { RefreshTokenRotationService } from '../../application/services/refresh-token-rotation-service.js';
import { TenantMembershipService } from '../../application/services/tenant-membership-service.js';
import { UserRegistrationService } from '../../application/services/user-registration-service.js';
import { AccountSecurityService } from '../../application/services/account-security-service.js';
import { MfaService } from '../../application/services/mfa-service.js';
import { CustomerService } from '../../application/services/customer-service.js';
import { QuotationService } from '../../application/services/quotation-service.js';
import { OrderService } from '../../application/services/order-service.js';
import { DeliveryService } from '../../application/services/delivery-service.js';
import { InvoiceService } from '../../application/services/invoice-service.js';
import { SalesReturnService } from '../../application/services/sales-return-service.js';
import { CreditNoteService } from '../../application/services/credit-note-service.js';
import { PricingService } from '../../application/services/pricing-service.js';
import { DiscountService } from '../../application/services/discount-service.js';
import { createDatabasePool } from '../../infrastructure/database/connection.js';
import { PostgresQueryPerformanceMonitor } from '../../infrastructure/database/query-performance-monitor.js';
import { IdentityAwarePostgresPlatformRepository } from '../../infrastructure/database/repositories/identity-aware-postgres-platform-repository.js';
import { PostgresAccountSecurityRepository } from '../../infrastructure/database/repositories/postgres-account-security-repository.js';
import { PostgresMfaRepository } from '../../infrastructure/database/repositories/postgres-mfa-repository.js';
import { PostgresCustomerRepository } from '../../infrastructure/database/repositories/postgres-customer-repository.js';
import { PostgresQuotationRepository } from '../../infrastructure/database/repositories/postgres-quotation-repository.js';
import { PostgresOrderRepository } from '../../infrastructure/database/repositories/postgres-order-repository.js';
import { PostgresDeliveryRepository } from '../../infrastructure/database/repositories/postgres-delivery-repository.js';
import { PostgresInvoiceRepository } from '../../infrastructure/database/repositories/postgres-invoice-repository.js';
import { PostgresSalesReturnRepository } from '../../infrastructure/database/repositories/postgres-sales-return-repository.js';
import { PostgresCreditNoteRepository } from '../../infrastructure/database/repositories/postgres-credit-note-repository.js';
import { PostgresPricingRepository } from '../../infrastructure/database/repositories/postgres-pricing-repository.js';
import { PostgresDiscountRepository } from '../../infrastructure/database/repositories/postgres-discount-repository.js';
import { PostgresNotificationService } from '../../infrastructure/database/repositories/postgres-operational-services.js';
import { AccountSecurityNotificationAdapter } from '../../application/adapters/account-security-notifications.js';
import { buildErrorHandler } from '../../infrastructure/http/error-handler.js';
import { applyCorrelationIdHooks } from '../../infrastructure/http/correlation-id.js';
import { BcryptPasswordHasher } from '../../infrastructure/security/bcrypt-password-hasher.js';
import { AesGcmSecretProtector } from '../../infrastructure/security/aes-secret-protector.js';
import { Rfc6238TotpProvider } from '../../infrastructure/security/totp.js';
import { JwtTokenService } from '../../infrastructure/security/jwt-token-service.js';
import { UnitOfWork } from '../../infrastructure/database/unit-of-work.js';
import { createLogger } from '../../infrastructure/logging/logger.js';
import { PostgresAuditLogger } from '../../infrastructure/audit/postgres-audit-logger.js';
import healthRoutes from './routes/health.js';
import authRoutes from './routes/auth.js';
import accountSecurityRoutes from './routes/account-security.js';
import mfaRoutes from './routes/mfa.js';
import branchRoutes from './routes/branch.js';
import coreEnterpriseRoutes from './routes/core-enterprise.js';
import jwksRoutes from './routes/jwks.js';
import locationRoutes from './routes/location.js';
import customerRoutes from './routes/customer.js';
import quotationRoutes from './routes/quotation.js';
import orderRoutes from './routes/order.js';
import deliveryRoutes from './routes/delivery.js';
import invoiceRoutes from './routes/invoice.js';
import salesReturnRoutes from './routes/sales-return.js';
import creditNoteRoutes from './routes/credit-note.js';
import pricingRoutes from './routes/pricing.js';
import discountRoutes from './routes/discount.js';
import rbacRoutes from './routes/rbac.js';
import { paginateListResponse } from './pagination.js';
import { requestObject } from './request-input.js';
import { schemaForRoute, setupSwagger } from './swagger.js';
import { recordSecurityEvent } from './security-audit.js';

const rotatedRefreshResponseSchema = {
  type: 'object',
  required: ['success', 'accessToken', 'refreshToken', 'expiresAt', 'tokenType', 'user'],
  properties: {
    success: { type: 'boolean', const: true },
    accessToken: { type: 'string' },
    refreshToken: { type: 'string' },
    expiresAt: { type: 'string', format: 'date-time' },
    tokenType: { type: 'string', const: 'bearer' },
    user: {
      type: 'object',
      required: [
        'id',
        'tenantId',
        'organizationId',
        'activeLocationId',
        'defaultLocationId',
        'defaultBranchId',
        'username',
        'email',
        'status',
      ],
      properties: {
        id: { type: 'string', format: 'uuid' },
        tenantId: { type: 'string', format: 'uuid' },
        organizationId: { type: ['string', 'null'], format: 'uuid' },
        activeLocationId: { type: ['string', 'null'], format: 'uuid' },
        defaultLocationId: { type: ['string', 'null'], format: 'uuid' },
        defaultBranchId: { type: ['string', 'null'], format: 'uuid' },
        username: { type: 'string' },
        email: { type: 'string', format: 'email' },
        status: { type: 'string' },
      },
    },
  },
} as const;

function resolveApiVersion(apiPrefix: string): string {
  const match = apiPrefix.match(/\/(v\d+)\/?$/i);
  return match?.[1]?.toLowerCase() ?? 'v1';
}

export async function createApplication(config: AppConfig, providedPool?: Pool): Promise<FastifyInstance> {
  const app = Fastify({
    logger: createLogger(config),
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
    ignoreTrailingSlash: true,
    bodyLimit: 1024 * 1024,
    ajv: { customOptions: { allErrors: true, coerceTypes: true, removeAdditional: false } },
  });
  const apiVersion = resolveApiVersion(config.API_PREFIX);

  app.addHook('onRoute', (routeOptions) => {
    routeOptions.schema = {
      ...routeOptions.schema,
      ...schemaForRoute(routeOptions.method as string, routeOptions.url),
    };
    if (String(routeOptions.method).includes('POST') && routeOptions.url.replace(/\/$/, '').endsWith('/auth/refresh')) {
      const existingResponse = (routeOptions.schema?.response ?? {}) as Record<string | number, unknown>;
      routeOptions.schema = {
        ...routeOptions.schema,
        response: { ...existingResponse, 200: rotatedRefreshResponseSchema },
      };
    }
  });

  app.addHook('onSend', async (request, reply, payload) => {
    reply.header('x-api-version', apiVersion);
    if (request.url.startsWith(config.API_PREFIX)) {
      reply.header('x-api-version-policy', 'path');
    }

    if (request.method !== 'GET' || request.url.includes('/rbac/roles') || request.url.includes('/rbac/permissions'))
      return payload;
    if (typeof payload !== 'string' && !Buffer.isBuffer(payload)) return payload;
    const raw = Buffer.isBuffer(payload) ? payload.toString('utf8') : payload;
    if (!raw.trim().startsWith('{')) return payload;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return JSON.stringify(paginateListResponse(request.url, parsed, request.query));
  });

  applyCorrelationIdHooks(app);
  const pool = providedPool ?? createDatabasePool(config);
  const queryPerformanceMonitor = new PostgresQueryPerformanceMonitor(pool);
  const auditLogger = new PostgresAuditLogger(pool, {
    tenantContextKey: config.TENANT_CONTEXT_KEY,
    allowedMetadataKeys: [
      'reason',
      'identifierType',
      'failureCount',
      'retryAfterSeconds',
      'sessionId',
      'provider',
      'tokenPurpose',
      'operation',
    ],
  });
  const repository = new IdentityAwarePostgresPlatformRepository(pool);
  const passwordHasher = new BcryptPasswordHasher();
  const jwtTokenService = new JwtTokenService(config);
  const authService = new AuthenticationService(repository, passwordHasher, jwtTokenService, {
    maxFailedAttempts: config.AUTH_MAX_FAILED_ATTEMPTS,
    lockoutMinutes: config.AUTH_LOCKOUT_MINUTES,
  });
  const authorizationService = new AuthorizationService(repository);
  const branchService = new BranchService(repository);
  const coreEnterpriseService = new CoreEnterpriseService(repository);
  const locationService = new LocationService(repository);
  const moduleAccessService = new ModuleAccessService(pool);
  const transactionRunner = new UnitOfWork(pool);
  const customerService = new CustomerService(
    new PostgresCustomerRepository(pool, config.TENANT_CONTEXT_KEY),
    authorizationService,
    moduleAccessService,
    auditLogger,
    transactionRunner,
  );
  const quotationService = new QuotationService(
    new PostgresQuotationRepository(pool, config.TENANT_CONTEXT_KEY),
    authorizationService,
    moduleAccessService,
    auditLogger,
    transactionRunner,
  );
  const orderService = new OrderService(
    new PostgresOrderRepository(pool, config.TENANT_CONTEXT_KEY),
    authorizationService,
    moduleAccessService,
    auditLogger,
    transactionRunner,
  );
  const deliveryService = new DeliveryService(
    new PostgresDeliveryRepository(pool, config.TENANT_CONTEXT_KEY),
    authorizationService,
    moduleAccessService,
    auditLogger,
    transactionRunner,
  );
  const invoiceService = new InvoiceService(
    new PostgresInvoiceRepository(pool, config.TENANT_CONTEXT_KEY),
    authorizationService,
    moduleAccessService,
    auditLogger,
    transactionRunner,
  );
  const salesReturnService = new SalesReturnService(
    new PostgresSalesReturnRepository(pool, config.TENANT_CONTEXT_KEY),
    authorizationService,
    moduleAccessService,
    auditLogger,
    transactionRunner,
  );
  const creditNoteService = new CreditNoteService(
    new PostgresCreditNoteRepository(pool, config.TENANT_CONTEXT_KEY),
    authorizationService,
    moduleAccessService,
    auditLogger,
    transactionRunner,
  );
  const pricingService = new PricingService(
    new PostgresPricingRepository(pool, config.TENANT_CONTEXT_KEY),
    authorizationService,
    moduleAccessService,
    auditLogger,
  );
  const discountService = new DiscountService(
    new PostgresDiscountRepository(pool, config.TENANT_CONTEXT_KEY),
    authorizationService,
    moduleAccessService,
  );
  const refreshTokenRotationService = new RefreshTokenRotationService(pool, config.TENANT_CONTEXT_KEY, jwtTokenService);
  const registrationService = new UserRegistrationService(
    repository,
    passwordHasher,
    {
      minLength: config.AUTH_PASSWORD_MIN_LENGTH,
      requireUppercase: config.AUTH_PASSWORD_REQUIRE_UPPERCASE,
      requireLowercase: config.AUTH_PASSWORD_REQUIRE_LOWERCASE,
      requireNumber: config.AUTH_PASSWORD_REQUIRE_NUMBER,
      requireSymbol: config.AUTH_PASSWORD_REQUIRE_SYMBOL,
    },
    transactionRunner,
  );
  const tenantMembershipService = new TenantMembershipService(repository);

  const accountSecurityRepository = new PostgresAccountSecurityRepository(pool, config.TENANT_CONTEXT_KEY);
  const notificationService = new PostgresNotificationService(pool, config.TENANT_CONTEXT_KEY);
  const accountSecurityService = new AccountSecurityService(
    accountSecurityRepository,
    passwordHasher,
    new AccountSecurityNotificationAdapter(notificationService),
  );
  const mfaRepository = new PostgresMfaRepository(pool, config.TENANT_CONTEXT_KEY);
  const mfaService = new MfaService(
    mfaRepository,
    new Rfc6238TotpProvider(),
    new AesGcmSecretProtector(config.MFA_ENCRYPTION_KEY),
    { issuer: config.APP_NAME },
  );

  app.decorate('appConfig', config);
  app.decorate('dbPool', pool);
  app.decorate('authService', authService);
  app.decorate('authorizationService', authorizationService);
  app.decorate('branchService', branchService);
  app.decorate('coreEnterpriseService', coreEnterpriseService);
  app.decorate('locationService', locationService);
  app.decorate('moduleAccessService', moduleAccessService);
  app.decorate('registrationService', registrationService);
  app.decorate('jwtTokenService', jwtTokenService);
  app.decorate('tenantMembershipService', tenantMembershipService);
  app.decorate('accountSecurityService', accountSecurityService);
  app.decorate('mfaService', mfaService);
  app.decorate('auditLogger', auditLogger);
  app.decorate('customerService', customerService);
  app.decorate('quotationService', quotationService);
  app.decorate('orderService', orderService);
  app.decorate('deliveryService', deliveryService);
  app.decorate('invoiceService', invoiceService);
  app.decorate('salesReturnService', salesReturnService);
  app.decorate('creditNoteService', creditNoteService);
  app.decorate('pricingService', pricingService);
  app.decorate('discountService', discountService);

  app.addHook('onReady', async () => {
    const snapshot = await queryPerformanceMonitor.snapshot({ minimumMeanExecMs: 100, limit: 25 });
    app.log.info(
      {
        queryPerformance: {
          available: snapshot.available,
          unavailableReason: snapshot.unavailableReason,
          slowStatementCount: snapshot.samples.length,
          maxMeanExecMs: snapshot.samples.reduce((max, sample) => Math.max(max, sample.meanExecMs), 0),
        },
      },
      'Query performance monitor initialized',
    );
  });

  app.addHook('preHandler', async (request, reply) => {
    if (request.method !== 'POST' || !request.routeOptions.url?.replace(/\/$/, '').endsWith('/auth/refresh')) return;
    const body = requestObject(request.body);
    const refreshToken = body.refreshToken;
    if (typeof refreshToken !== 'string' || refreshToken.length === 0) return;
    let rotated;
    try {
      rotated = await refreshTokenRotationService.rotate(refreshToken);
    } catch (error) {
      if (error instanceof Error && error.message.includes('reuse detected')) {
        const claims = jwtTokenService.verifyRefreshToken(refreshToken);
        await recordSecurityEvent(request, {
          tenantId: claims.tenantId,
          actorUserId: claims.sub,
          action: 'auth.refresh.replay',
          resourceType: 'session',
          resourceId: claims.sessionId,
          outcome: 'failure',
          metadata: { reason: 'refresh_token_reuse', sessionId: claims.sessionId },
        });
      }
      throw error;
    }
    await recordSecurityEvent(request, {
      tenantId: rotated.tenantId,
      actorUserId: rotated.userId,
      action: 'auth.session.refresh',
      resourceType: 'session',
      resourceId: rotated.sessionId,
      outcome: 'success',
      metadata: { sessionId: rotated.sessionId },
    });
    return reply.code(200).send({
      success: true,
      accessToken: rotated.accessToken,
      refreshToken: rotated.refreshToken,
      expiresAt: rotated.accessTokenExpiresAt,
      tokenType: 'bearer',
      user: {
        id: rotated.user.id,
        tenantId: rotated.user.tenantId,
        organizationId: rotated.user.organizationId ?? null,
        activeLocationId: rotated.user.activeLocationId ?? null,
        defaultLocationId: rotated.user.defaultLocationId ?? null,
        defaultBranchId: rotated.user.defaultBranchId ?? null,
        username: rotated.user.username,
        email: rotated.user.email,
        status: rotated.user.status,
      },
    });
  });

  await app.register(cors, {
    origin: (origin, callback) => callback(null, isCorsOriginAllowed(config, origin)),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id'],
    exposedHeaders: ['x-api-version', 'x-api-version-policy', 'x-request-id'],
    credentials: true,
    optionsSuccessStatus: 204,
  });
  await app.register(rateLimit, {
    global: false,
    keyGenerator: (request) => request.ip,
    errorResponseBuilder: (_request, context) =>
      Object.assign(new Error(`Too many requests. Try again in ${Math.ceil(context.ttl / 1000)} seconds.`), {
        code: 'RATE_LIMIT_EXCEEDED',
        statusCode: context.statusCode,
      }),
  });
  await setupSwagger(app);
  app.setErrorHandler(buildErrorHandler(config));
  await app.register(jwksRoutes);
  await app.register(healthRoutes, { prefix: config.API_PREFIX });
  await app.register(authRoutes, { prefix: config.API_PREFIX });
  await app.register(accountSecurityRoutes, { prefix: config.API_PREFIX });
  await app.register(mfaRoutes, { prefix: config.API_PREFIX });
  await app.register(rbacRoutes, { prefix: config.API_PREFIX });
  await app.register(branchRoutes, { prefix: config.API_PREFIX });
  await app.register(coreEnterpriseRoutes, { prefix: config.API_PREFIX });
  await app.register(locationRoutes, { prefix: config.API_PREFIX });
  await app.register(customerRoutes, { prefix: config.API_PREFIX });
  await app.register(quotationRoutes, { prefix: config.API_PREFIX });
  await app.register(orderRoutes, { prefix: config.API_PREFIX });
  await app.register(deliveryRoutes, { prefix: config.API_PREFIX });
  await app.register(invoiceRoutes, { prefix: config.API_PREFIX });
  await app.register(salesReturnRoutes, { prefix: config.API_PREFIX });
  await app.register(creditNoteRoutes, { prefix: config.API_PREFIX });
  await app.register(pricingRoutes, { prefix: config.API_PREFIX });
  await app.register(discountRoutes, { prefix: config.API_PREFIX });
  return app;
}
