import type { FastifyReply, FastifyRequest } from 'fastify';

import type { AuthenticatedUser } from '../../../domain/contracts/authentication.js';
import { ForbiddenError, UnauthorizedError } from '../../../domain/errors.js';
import type { AuthenticationService } from '../../../application/services/authentication-service.js';
import type { AuthorizationService } from '../../../application/services/authorization-service.js';
import type { CoreEnterpriseService } from '../../../application/services/core-enterprise-service.js';
import type { LocationService } from '../../../application/services/location-service.js';
import type { ModuleAccessService } from '../../../application/services/module-access-service.js';
import type { UserRegistrationService } from '../../../application/services/user-registration-service.js';
import type { JwtTokenService } from '../../../infrastructure/security/jwt-token-service.js';
import type { AppConfig } from '../../../config/schema.js';
import type { TenantResolutionService } from '../../../application/services/tenant-resolution-service.js';

declare module 'fastify' {
  interface FastifyInstance {
    appConfig: AppConfig;
    authService: AuthenticationService;
    authorizationService: AuthorizationService;
    moduleAccessService: ModuleAccessService;
    coreEnterpriseService: CoreEnterpriseService;
    locationService: LocationService;
    registrationService: UserRegistrationService;
    jwtTokenService: JwtTokenService;
    tenantResolver: TenantResolutionService;
  }

  interface FastifyRequest {
    user?: AuthenticatedUser;
    tenantId?: string;
    sessionId?: string;
  }
}

export function getBearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header || typeof header !== 'string') {
    return null;
  }

  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) {
    return null;
  }

  return match[1];
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = getBearerToken(request);
  if (!token) {
    throw new UnauthorizedError('Authentication token is required.');
  }

  const claims = request.server.jwtTokenService.verifyAccessToken(token);
  const session = await request.server.authService.validateSession(claims.sessionId, claims.tenantId);
  if (!session) {
    throw new UnauthorizedError('Session is invalid or expired.');
  }

  const tenantHeader = request.server.appConfig.TENANT_HEADER.toLowerCase();
  const requestTenant = request.headers[tenantHeader];
  if (requestTenant && typeof requestTenant === 'string' && requestTenant !== claims.tenantId) {
    throw new UnauthorizedError('Tenant mismatch detected.');
  }

  request.user = session;
  request.tenantId = session.tenantId;
  request.sessionId = claims.sessionId;
}

export function requirePermission(permissionKey: string) {
  return async function requirePermissionHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!request.user || !request.tenantId) {
      throw new UnauthorizedError('Authentication is required to perform this action.');
    }

    const allowed = await request.server.authorizationService.hasPermission(request.tenantId, request.user.id, permissionKey);
    if (!allowed) {
      throw new ForbiddenError('Permission denied or module is not enabled for the organization.');
    }
  };
}

export function requirePermissionOrSelf(permissionKey: string, selfIdGetter?: (request: FastifyRequest) => string | null | undefined) {
  return async function requirePermissionOrSelfHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!request.user || !request.tenantId) {
      throw new UnauthorizedError('Authentication is required to perform this action.');
    }

    const resolvedSelfId = selfIdGetter ? selfIdGetter(request) : null;
    if (resolvedSelfId && request.user.id === resolvedSelfId) {
      return;
    }

    const allowed = await request.server.authorizationService.hasPermission(request.tenantId, request.user.id, permissionKey);
    if (!allowed) {
      throw new ForbiddenError('Permission denied or module is not enabled for the organization.');
    }
  };
}