import { type FastifyPluginAsync, type FastifyRequest } from 'fastify';

import { NotFoundError, ValidationError } from '../../../domain/errors.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';

const getTenantIdFromRequest = (request: FastifyRequest): string | null => request.tenantId ?? null;

const asString = (value: unknown): string | null => (typeof value === 'string' ? value.trim() : null);

const coreEnterpriseRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/organizations', { preHandler: [requireAuth, requirePermission('organization.manage')] }, async (request, reply) => {
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) {
      throw new ValidationError('Tenant context is required.');
    }

    const body = request.body as Record<string, unknown> | undefined;
    const organization = await request.server.coreEnterpriseService.createOrganization(tenantId, {
      name: asString(body?.name) ?? undefined,
      legalName: asString(body?.legalName) ?? undefined,
      gstNo: asString(body?.gstNo) ?? undefined,
      panNo: asString(body?.panNo) ?? undefined,
      cinNo: asString(body?.cinNo) ?? undefined,
      email: asString(body?.email) ?? undefined,
      phone: asString(body?.phone) ?? undefined,
      website: asString(body?.website) ?? undefined,
      baseCurrency: asString(body?.baseCurrency) ?? 'USD',
      fiscalCalendar: asString(body?.fiscalCalendar) ?? 'standard',
      status: typeof body?.status === 'string' ? (body.status as 'active' | 'inactive' | 'archived') : 'active',
      isDefault: typeof body?.isDefault === 'boolean' ? body.isDefault : false,
      remarks: typeof body?.remarks === 'string' ? body.remarks : null,
    });

    reply.code(201);
    return { success: true, organization };
  });

  fastify.get('/organizations', { preHandler: [requireAuth, requirePermission('organization.read')] }, async (request) => {
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) {
      throw new ValidationError('Tenant context is required.');
    }

    const organizations = await request.server.coreEnterpriseService.listOrganizations(tenantId);
    return { success: true, organizations };
  });

  fastify.get('/organizations/:id', { preHandler: [requireAuth, requirePermission('organization.read')] }, async (request) => {
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) {
      throw new ValidationError('Tenant context is required.');
    }

    const organizationId = asString((request.params as { id?: string }).id) ?? '';
    const organization = await request.server.coreEnterpriseService.getOrganization(tenantId, organizationId);
    if (!organization) {
      throw new NotFoundError('Organization not found.');
    }

    return { success: true, organization };
  });

  fastify.patch('/organizations/:id', { preHandler: [requireAuth, requirePermission('organization.manage')] }, async (request) => {
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) {
      throw new ValidationError('Tenant context is required.');
    }

    const body = request.body as Record<string, unknown> | undefined;
    const organizationId = asString((request.params as { id?: string }).id) ?? '';
    const updated = await request.server.coreEnterpriseService.updateOrganization(tenantId, organizationId, {
      code: typeof body?.code === 'string' ? body.code : undefined,
      name: typeof body?.name === 'string' ? body.name : undefined,
      legalName: typeof body?.legalName === 'string' ? body.legalName : body?.legalName === null ? null : undefined,
      gstNo: typeof body?.gstNo === 'string' ? body.gstNo : body?.gstNo === null ? null : undefined,
      panNo: typeof body?.panNo === 'string' ? body.panNo : body?.panNo === null ? null : undefined,
      cinNo: typeof body?.cinNo === 'string' ? body.cinNo : body?.cinNo === null ? null : undefined,
      email: typeof body?.email === 'string' ? body.email : body?.email === null ? null : undefined,
      phone: typeof body?.phone === 'string' ? body.phone : body?.phone === null ? null : undefined,
      website: typeof body?.website === 'string' ? body.website : body?.website === null ? null : undefined,
      baseCurrency: typeof body?.baseCurrency === 'string' ? body.baseCurrency : undefined,
      fiscalCalendar: typeof body?.fiscalCalendar === 'string' ? body.fiscalCalendar : undefined,
      status: typeof body?.status === 'string' ? (body.status as 'active' | 'inactive' | 'archived') : undefined,
      isDefault: typeof body?.isDefault === 'boolean' ? body.isDefault : undefined,
      remarks: typeof body?.remarks === 'string' ? body.remarks : body?.remarks === null ? null : undefined,
    });

    if (!updated) {
      throw new NotFoundError('Organization not found.');
    }

    return { success: true, organization: updated };
  });

  fastify.post('/organizations/:id/deactivate', { preHandler: [requireAuth, requirePermission('organization.manage')] }, async (request) => {
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) {
      throw new ValidationError('Tenant context is required.');
    }

    const organizationId = asString((request.params as { id?: string }).id) ?? '';
    const deactivated = await request.server.coreEnterpriseService.deactivateOrganization(tenantId, organizationId);
    if (!deactivated) {
      throw new NotFoundError('Organization not found.');
    }

    return { success: true, deactivated: true };
  });

  fastify.post('/organizations/:organizationId/branches', { preHandler: [requireAuth, requirePermission('branch.manage')] }, async (request, reply) => {
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) {
      throw new ValidationError('Tenant context is required.');
    }

    const body = request.body as Record<string, unknown> | undefined;
    const organizationId = asString((request.params as { organizationId?: string }).organizationId) ?? '';
    const branch = await request.server.coreEnterpriseService.createBranch(tenantId, organizationId, {
      name: asString(body?.name) ?? undefined,
      status: typeof body?.status === 'string' ? (body.status as 'active' | 'inactive' | 'archived') : 'active',
      isHeadOffice: typeof body?.isHeadOffice === 'boolean' ? body.isHeadOffice : false,
      isDefault: typeof body?.isDefault === 'boolean' ? body.isDefault : false,
      addressLine1: typeof body?.addressLine1 === 'string' ? body.addressLine1 : null,
      addressLine2: typeof body?.addressLine2 === 'string' ? body.addressLine2 : null,
      city: typeof body?.city === 'string' ? body.city : null,
      district: typeof body?.district === 'string' ? body.district : null,
      state: typeof body?.state === 'string' ? body.state : null,
      country: typeof body?.country === 'string' ? body.country : null,
      postalCode: typeof body?.postalCode === 'string' ? body.postalCode : null,
      timezone: typeof body?.timezone === 'string' ? body.timezone : 'UTC',
      remarks: typeof body?.remarks === 'string' ? body.remarks : null,
    });

    reply.code(201);
    return { success: true, branch };
  });

  fastify.get('/organizations/:organizationId/branches', { preHandler: [requireAuth, requirePermission('branch.read')] }, async (request) => {
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) {
      throw new ValidationError('Tenant context is required.');
    }

    const organizationId = asString((request.params as { organizationId?: string }).organizationId) ?? '';
    const branches = await request.server.coreEnterpriseService.listBranches(tenantId, organizationId);
    return { success: true, branches };
  });

  fastify.get('/organizations/:organizationId/branches/:branchId', { preHandler: [requireAuth, requirePermission('branch.read')] }, async (request) => {
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) {
      throw new ValidationError('Tenant context is required.');
    }

    const organizationId = asString((request.params as { organizationId?: string }).organizationId) ?? '';
    const branchId = asString((request.params as { branchId?: string }).branchId) ?? '';
    const branch = await request.server.coreEnterpriseService.getBranch(tenantId, organizationId, branchId);
    if (!branch) {
      throw new NotFoundError('Branch not found.');
    }
    return { success: true, branch };
  });

  fastify.patch('/organizations/:organizationId/branches/:branchId', { preHandler: [requireAuth, requirePermission('branch.manage')] }, async (request) => {
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) {
      throw new ValidationError('Tenant context is required.');
    }

    const body = request.body as Record<string, unknown> | undefined;
    const organizationId = asString((request.params as { organizationId?: string }).organizationId) ?? '';
    const branchId = asString((request.params as { branchId?: string }).branchId) ?? '';
    const updated = await request.server.coreEnterpriseService.updateBranch(tenantId, organizationId, branchId, {
      code: typeof body?.code === 'string' ? body.code : undefined,
      name: typeof body?.name === 'string' ? body.name : undefined,
      status: typeof body?.status === 'string' ? (body.status as 'active' | 'inactive' | 'archived') : undefined,
      isHeadOffice: typeof body?.isHeadOffice === 'boolean' ? body.isHeadOffice : undefined,
      isDefault: typeof body?.isDefault === 'boolean' ? body.isDefault : undefined,
      addressLine1: typeof body?.addressLine1 === 'string' ? body.addressLine1 : body?.addressLine1 === null ? null : undefined,
      addressLine2: typeof body?.addressLine2 === 'string' ? body.addressLine2 : body?.addressLine2 === null ? null : undefined,
      city: typeof body?.city === 'string' ? body.city : body?.city === null ? null : undefined,
      district: typeof body?.district === 'string' ? body.district : body?.district === null ? null : undefined,
      state: typeof body?.state === 'string' ? body.state : body?.state === null ? null : undefined,
      country: typeof body?.country === 'string' ? body.country : body?.country === null ? null : undefined,
      postalCode: typeof body?.postalCode === 'string' ? body.postalCode : body?.postalCode === null ? null : undefined,
      timezone: typeof body?.timezone === 'string' ? body.timezone : undefined,
      remarks: typeof body?.remarks === 'string' ? body.remarks : body?.remarks === null ? null : undefined,
    });

    if (!updated) {
      throw new NotFoundError('Branch not found.');
    }

    return { success: true, branch: updated };
  });

  fastify.post('/organizations/:organizationId/branches/:branchId/deactivate', { preHandler: [requireAuth, requirePermission('branch.manage')] }, async (request) => {
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) {
      throw new ValidationError('Tenant context is required.');
    }

    const organizationId = asString((request.params as { organizationId?: string }).organizationId) ?? '';
    const branchId = asString((request.params as { branchId?: string }).branchId) ?? '';
    const deactivated = await request.server.coreEnterpriseService.deactivateBranch(tenantId, organizationId, branchId);
    if (!deactivated) {
      throw new NotFoundError('Branch not found.');
    }

    return { success: true, deactivated: true };
  });

  fastify.get('/users', { preHandler: [requireAuth, requirePermission('user.read')] }, async (request) => {
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) {
      throw new ValidationError('Tenant context is required.');
    }

    const users = await request.server.coreEnterpriseService.listUsers(tenantId);
    return { success: true, users };
  });

  fastify.get('/users/:id', { preHandler: [requireAuth, requirePermission('user.read')] }, async (request) => {
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) {
      throw new ValidationError('Tenant context is required.');
    }

    const userId = asString((request.params as { id?: string }).id) ?? '';
    const user = await request.server.coreEnterpriseService.getUser(tenantId, userId);
    if (!user) {
      throw new NotFoundError('User not found.');
    }

    return { success: true, user };
  });

  fastify.patch('/users/:id', { preHandler: [requireAuth, requirePermission('user.manage')] }, async (request) => {
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) {
      throw new ValidationError('Tenant context is required.');
    }

    const body = request.body as Record<string, unknown> | undefined;
    const userId = asString((request.params as { id?: string }).id) ?? '';
    const updated = await request.server.coreEnterpriseService.updateUser(tenantId, userId, {
      username: typeof body?.username === 'string' ? body.username : undefined,
      email: typeof body?.email === 'string' ? body.email : undefined,
      organizationId: typeof body?.organizationId === 'string' ? body.organizationId : body?.organizationId === null ? null : undefined,
      defaultBranchId: typeof body?.defaultBranchId === 'string' ? body.defaultBranchId : body?.defaultBranchId === null ? null : undefined,
      status: typeof body?.status === 'string' ? (body.status as 'active' | 'inactive' | 'locked' | 'pending_verification') : undefined,
    });

    if (!updated) {
      throw new NotFoundError('User not found.');
    }

    return { success: true, user: updated };
  });

  fastify.post('/users/:userId/organizations/:organizationId/access', { preHandler: [requireAuth, requirePermission('user.manage')] }, async (request) => {
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) {
      throw new ValidationError('Tenant context is required.');
    }

    const userId = asString((request.params as { userId?: string }).userId) ?? '';
    const organizationId = asString((request.params as { organizationId?: string }).organizationId) ?? '';
    const assigned = await request.server.coreEnterpriseService.assignUserToOrganization(tenantId, userId, organizationId);
    if (!assigned) {
      throw new NotFoundError('User or organization not found.');
    }

    return { success: true, assigned: true };
  });

  fastify.post('/users/:userId/branches/:branchId/access', { preHandler: [requireAuth, requirePermission('user.manage')] }, async (request) => {
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) {
      throw new ValidationError('Tenant context is required.');
    }

    const userId = asString((request.params as { userId?: string }).userId) ?? '';
    const branchId = asString((request.params as { branchId?: string }).branchId) ?? '';
    const assigned = await request.server.coreEnterpriseService.assignUserToBranch(tenantId, userId, branchId);
    if (!assigned) {
      throw new NotFoundError('User or branch not found.');
    }

    return { success: true, assigned: true };
  });

  fastify.post('/users/:id/activate', { preHandler: [requireAuth, requirePermission('user.manage')] }, async (request) => {
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) {
      throw new ValidationError('Tenant context is required.');
    }

    const userId = asString((request.params as { id?: string }).id) ?? '';
    const activated = await request.server.coreEnterpriseService.activateUser(tenantId, userId);
    if (!activated) {
      throw new NotFoundError('User not found.');
    }

    return { success: true, activated: true };
  });

  fastify.post('/users/:id/deactivate', { preHandler: [requireAuth, requirePermission('user.manage')] }, async (request) => {
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) {
      throw new ValidationError('Tenant context is required.');
    }

    const userId = asString((request.params as { id?: string }).id) ?? '';
    const deactivated = await request.server.coreEnterpriseService.deactivateUser(tenantId, userId);
    if (!deactivated) {
      throw new NotFoundError('User not found.');
    }

    return { success: true, deactivated: true };
  });
};

export default coreEnterpriseRoutes;
