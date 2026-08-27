import { type FastifyPluginAsync } from 'fastify';

import { NotFoundError, ValidationError } from '../../../domain/errors.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';

const asString = (value: unknown): string | null => (typeof value === 'string' ? value.trim() : null);

const locationRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/locations', { preHandler: [requireAuth, requirePermission('organization.read')] }, async (request) => {
    if (!request.tenantId || !request.user) throw new ValidationError('Authenticated tenant context is required.');
    const organizationId = request.user.organizationId ?? null;
    if (!organizationId) throw new ValidationError('An active organization is required before resolving locations.');
    const locations = await request.server.locationService.listAccessibleLocationsForUser(request.tenantId, request.user.id, organizationId);
    return { success: true, locations };
  });

  fastify.get('/locations/:id', { preHandler: [requireAuth, requirePermission('organization.read')] }, async (request) => {
    if (!request.tenantId || !request.user) throw new ValidationError('Authenticated tenant context is required.');
    const organizationId = request.user.organizationId ?? null;
    if (!organizationId) throw new ValidationError('An active organization is required before resolving locations.');
    const locationId = asString((request.params as { id?: string }).id) ?? '';
    const location = await request.server.locationService.getAccessibleLocationByIdForUser(request.tenantId, request.user.id, locationId, organizationId);
    if (!location) throw new NotFoundError('Location not found or access denied.');
    return { success: true, location };
  });

  fastify.get('/locations/active', { preHandler: [requireAuth, requirePermission('organization.read')] }, async (request) => {
    if (!request.tenantId || !request.user) throw new ValidationError('Authenticated tenant context is required.');
    const organizationId = request.user.organizationId ?? null;
    if (!organizationId || !request.user.activeLocationId) return { success: true, activeLocationId: null, location: null };
    const location = await request.server.locationService.getAccessibleLocationByIdForUser(request.tenantId, request.user.id, request.user.activeLocationId, organizationId);
    if (!location) return { success: true, activeLocationId: null, location: null };
    return { success: true, activeLocationId: location.id, location };
  });

  fastify.post('/locations/:id/select', { preHandler: [requireAuth, requirePermission('organization.read')] }, async (request, reply) => {
    if (!request.tenantId || !request.user) throw new ValidationError('Authenticated tenant context is required.');
    const organizationId = request.user.organizationId ?? null;
    if (!organizationId) throw new ValidationError('An active organization is required before selecting a location.');
    const locationId = asString((request.params as { id?: string }).id) ?? '';
    const location = await request.server.locationService.getAccessibleLocationByIdForUser(request.tenantId, request.user.id, locationId, organizationId);
    if (!location) throw new NotFoundError('Location not found or access denied.');
    const result = await request.server.authService.createSessionForUser(request.tenantId, request.user.id, organizationId, location.id);
    if (!result.success || !result.user || !result.session || !result.accessToken || !result.refreshToken) throw new ValidationError('Unable to establish the selected active location.');
    reply.code(200);
    return {
      success: true,
      user: { id: result.user.id, tenantId: result.user.tenantId, organizationId: result.user.organizationId ?? organizationId, activeLocationId: result.user.activeLocationId ?? location.id, defaultBranchId: result.user.defaultBranchId ?? null, username: result.user.username, email: result.user.email, status: result.user.status },
      session: { id: result.session.id, tenantId: result.session.tenantId, userId: result.session.userId, organizationId: result.session.organizationId ?? organizationId, locationId: result.session.locationId ?? location.id, branchId: result.session.branchId ?? null, isActive: result.session.isActive, expiresAt: result.session.expiresAt, loginAt: result.session.loginAt },
      location,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresAt: result.session.expiresAt,
      tokenType: 'bearer',
    };
  });

  fastify.post('/locations', { preHandler: [requireAuth, requirePermission('organization.manage')] }, async (request, reply) => {
    if (!request.tenantId || !request.user) throw new ValidationError('Authenticated tenant context is required.');
    const body = request.body as Record<string, unknown> | undefined;
    const organizationId = asString(body?.organizationId) ?? request.user.organizationId ?? '';
    if (!organizationId) throw new ValidationError('Organization context is required.');
    const location = await request.server.locationService.createLocation(request.tenantId, organizationId, {
      code: asString(body?.code) ?? '', name: asString(body?.name) ?? '', description: typeof body?.description === 'string' ? body.description : null,
      status: typeof body?.status === 'string' ? (body.status as 'active' | 'inactive' | 'archived') : 'active', isDefault: typeof body?.isDefault === 'boolean' ? body.isDefault : false,
      addressLine1: typeof body?.addressLine1 === 'string' ? body.addressLine1 : null, addressLine2: typeof body?.addressLine2 === 'string' ? body.addressLine2 : null,
      city: typeof body?.city === 'string' ? body.city : null, state: typeof body?.state === 'string' ? body.state : null, country: typeof body?.country === 'string' ? body.country : null,
      postalCode: typeof body?.postalCode === 'string' ? body.postalCode : null, timezone: typeof body?.timezone === 'string' ? body.timezone : 'UTC',
    });
    reply.code(201);
    return { success: true, location };
  });

  fastify.patch('/locations/:id', { preHandler: [requireAuth, requirePermission('organization.manage')] }, async (request) => {
    if (!request.tenantId || !request.user) throw new ValidationError('Authenticated tenant context is required.');
    const locationId = asString((request.params as { id?: string }).id) ?? '';
    const body = request.body as Record<string, unknown> | undefined;
    const currentLocation = await request.server.locationService.getAccessibleLocationByIdForUser(request.tenantId, request.user.id, locationId, request.user.organizationId ?? null);
    if (!currentLocation) throw new NotFoundError('Location not found or access denied.');
    const location = await request.server.locationService.updateLocation(request.tenantId, currentLocation.organizationId, locationId, {
      code: typeof body?.code === 'string' ? body.code : undefined, name: typeof body?.name === 'string' ? body.name : undefined,
      description: typeof body?.description === 'string' ? body.description : body?.description === null ? null : undefined,
      status: typeof body?.status === 'string' ? (body.status as 'active' | 'inactive' | 'archived') : undefined,
      isDefault: typeof body?.isDefault === 'boolean' ? body.isDefault : undefined,
      addressLine1: typeof body?.addressLine1 === 'string' ? body.addressLine1 : body?.addressLine1 === null ? null : undefined,
      addressLine2: typeof body?.addressLine2 === 'string' ? body.addressLine2 : body?.addressLine2 === null ? null : undefined,
      city: typeof body?.city === 'string' ? body.city : body?.city === null ? null : undefined,
      state: typeof body?.state === 'string' ? body.state : body?.state === null ? null : undefined,
      country: typeof body?.country === 'string' ? body.country : body?.country === null ? null : undefined,
      postalCode: typeof body?.postalCode === 'string' ? body.postalCode : body?.postalCode === null ? null : undefined,
      timezone: typeof body?.timezone === 'string' ? body.timezone : undefined,
    });
    if (!location) throw new NotFoundError('Location update failed.');
    return { success: true, location };
  });

  fastify.post('/locations/:id/deactivate', { preHandler: [requireAuth, requirePermission('organization.manage')] }, async (request) => {
    if (!request.tenantId || !request.user) throw new ValidationError('Authenticated tenant context is required.');
    const locationId = asString((request.params as { id?: string }).id) ?? '';
    const currentLocation = await request.server.locationService.getAccessibleLocationByIdForUser(request.tenantId, request.user.id, locationId, request.user.organizationId ?? null);
    if (!currentLocation) throw new NotFoundError('Location not found or access denied.');
    const deactivated = await request.server.locationService.deactivateLocation(request.tenantId, currentLocation.organizationId, locationId);
    if (!deactivated) throw new NotFoundError('Location not found.');
    return { success: true, deactivated: true };
  });
};

export default locationRoutes;
