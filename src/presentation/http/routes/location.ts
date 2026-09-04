import { type FastifyPluginAsync } from 'fastify';

import { NotFoundError, ValidationError } from '../../../domain/errors.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';

type LocationStatus = 'active' | 'inactive' | 'archived';

interface LocationIdParams {
  id: string;
}

interface CreateLocationBody {
  organizationId?: string;
  name: string;
  description?: string | null;
  status?: LocationStatus;
  isDefault?: boolean;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  timezone?: string;
}

type UpdateLocationBody = Partial<Omit<CreateLocationBody, 'organizationId'>>;

const locationRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/locations', { preHandler: [requireAuth, requirePermission('organization.read')] }, async (request) => {
    if (!request.tenantId || !request.user) throw new ValidationError('Authenticated tenant context is required.');
    const organizationId = request.user.organizationId ?? null;
    if (!organizationId) throw new ValidationError('An active organization is required before resolving locations.');
    const locations = await request.server.locationService.listAccessibleLocationsForUser(
      request.tenantId,
      request.user.id,
      organizationId,
    );
    return { success: true, locations };
  });

  fastify.get<{ Params: LocationIdParams }>(
    '/locations/:id',
    { preHandler: [requireAuth, requirePermission('organization.read')] },
    async (request) => {
      if (!request.tenantId || !request.user) throw new ValidationError('Authenticated tenant context is required.');
      const organizationId = request.user.organizationId ?? null;
      if (!organizationId) throw new ValidationError('An active organization is required before resolving locations.');
      const locationId = request.params.id.trim();
      const location = await request.server.locationService.getAccessibleLocationByIdForUser(
        request.tenantId,
        request.user.id,
        locationId,
        organizationId,
      );
      if (!location) throw new NotFoundError('Location not found or access denied.');
      return { success: true, location };
    },
  );

  fastify.get(
    '/locations/active',
    { preHandler: [requireAuth, requirePermission('organization.read')] },
    async (request) => {
      if (!request.tenantId || !request.user) throw new ValidationError('Authenticated tenant context is required.');
      const organizationId = request.user.organizationId ?? null;
      if (!organizationId || !request.user.activeLocationId)
        return { success: true, activeLocationId: null, location: null };
      const location = await request.server.locationService.getAccessibleLocationByIdForUser(
        request.tenantId,
        request.user.id,
        request.user.activeLocationId,
        organizationId,
      );
      if (!location) return { success: true, activeLocationId: null, location: null };
      return { success: true, activeLocationId: location.id, location };
    },
  );

  fastify.post<{ Params: LocationIdParams }>(
    '/locations/:id/select',
    { preHandler: [requireAuth, requirePermission('organization.read')] },
    async (request, reply) => {
      if (!request.tenantId || !request.user) throw new ValidationError('Authenticated tenant context is required.');
      const organizationId = request.user.organizationId ?? null;
      if (!organizationId) throw new ValidationError('An active organization is required before selecting a location.');
      const locationId = request.params.id.trim();
      const location = await request.server.locationService.getAccessibleLocationByIdForUser(
        request.tenantId,
        request.user.id,
        locationId,
        organizationId,
      );
      if (!location) throw new NotFoundError('Location not found or access denied.');
      const result = await request.server.authService.createSessionForUser(
        request.tenantId,
        request.user.id,
        organizationId,
        location.id,
      );
      if (!result.success || !result.user || !result.session || !result.accessToken || !result.refreshToken)
        throw new ValidationError('Unable to establish the selected active location.');
      reply.code(200);
      return {
        success: true,
        user: {
          id: result.user.id,
          tenantId: result.user.tenantId,
          organizationId: result.user.organizationId ?? organizationId,
          activeLocationId: result.user.activeLocationId ?? location.id,
          defaultLocationId: result.user.defaultLocationId ?? null,
          defaultBranchId: result.user.defaultBranchId ?? null,
          username: result.user.username,
          email: result.user.email,
          status: result.user.status,
        },
        session: {
          id: result.session.id,
          tenantId: result.session.tenantId,
          userId: result.session.userId,
          organizationId: result.session.organizationId ?? organizationId,
          locationId: result.session.locationId ?? location.id,
          branchId: result.session.branchId ?? null,
          isActive: result.session.isActive,
          expiresAt: result.session.expiresAt,
          loginAt: result.session.loginAt,
        },
        location,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresAt: result.session.expiresAt,
        tokenType: 'bearer',
      };
    },
  );

  fastify.post<{ Body: CreateLocationBody }>(
    '/locations',
    { preHandler: [requireAuth, requirePermission('organization.manage')] },
    async (request, reply) => {
      if (!request.tenantId || !request.user) throw new ValidationError('Authenticated tenant context is required.');
      const body = request.body;
      const organizationId = body.organizationId?.trim() || request.user.organizationId || '';
      if (!organizationId) throw new ValidationError('Organization context is required.');
      const location = await request.server.locationService.createLocation(request.tenantId, organizationId, {
        name: body.name?.trim() ?? '',
        description: body.description ?? null,
        status: body.status ?? 'active',
        isDefault: body.isDefault ?? false,
        addressLine1: body.addressLine1 ?? null,
        addressLine2: body.addressLine2 ?? null,
        city: body.city ?? null,
        state: body.state ?? null,
        country: body.country ?? null,
        postalCode: body.postalCode ?? null,
        timezone: body.timezone ?? 'UTC',
      });
      reply.code(201);
      return { success: true, location };
    },
  );

  fastify.patch<{ Params: LocationIdParams; Body: UpdateLocationBody }>(
    '/locations/:id',
    { preHandler: [requireAuth, requirePermission('organization.manage')] },
    async (request) => {
      if (!request.tenantId || !request.user) throw new ValidationError('Authenticated tenant context is required.');
      const locationId = request.params.id.trim();
      const body = request.body;
      const currentLocation = await request.server.locationService.getAccessibleLocationByIdForUser(
        request.tenantId,
        request.user.id,
        locationId,
        request.user.organizationId ?? null,
      );
      if (!currentLocation) throw new NotFoundError('Location not found or access denied.');
      const location = await request.server.locationService.updateLocation(
        request.tenantId,
        currentLocation.organizationId,
        locationId,
        {
          name: body.name,
          description: body.description,
          status: body.status,
          isDefault: body.isDefault,
          addressLine1: body.addressLine1,
          addressLine2: body.addressLine2,
          city: body.city,
          state: body.state,
          country: body.country,
          postalCode: body.postalCode,
          timezone: body.timezone,
        },
      );
      if (!location) throw new NotFoundError('Location update failed.');
      return { success: true, location };
    },
  );

  fastify.post<{ Params: LocationIdParams }>(
    '/locations/:id/deactivate',
    { preHandler: [requireAuth, requirePermission('organization.manage')] },
    async (request) => {
      if (!request.tenantId || !request.user) throw new ValidationError('Authenticated tenant context is required.');
      const locationId = request.params.id.trim();
      const currentLocation = await request.server.locationService.getAccessibleLocationByIdForUser(
        request.tenantId,
        request.user.id,
        locationId,
        request.user.organizationId ?? null,
      );
      if (!currentLocation) throw new NotFoundError('Location not found or access denied.');
      const deactivated = await request.server.locationService.deactivateLocation(
        request.tenantId,
        currentLocation.organizationId,
        locationId,
      );
      if (!deactivated) throw new NotFoundError('Location not found.');
      return { success: true, deactivated: true };
    },
  );
};

export default locationRoutes;
