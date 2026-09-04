import { type FastifyPluginAsync, type FastifyRequest } from 'fastify';

import { NotFoundError, ValidationError } from '../../../domain/errors.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';

type EnterpriseStatus = 'active' | 'inactive' | 'archived';
type UserStatus = 'active' | 'inactive' | 'locked' | 'pending_verification';

interface IdParams {
  id: string;
}

interface OrganizationParams {
  organizationId: string;
}

interface OrganizationBranchParams extends OrganizationParams {
  branchId: string;
}

interface UserOrganizationAccessParams {
  userId: string;
  organizationId: string;
}

interface UserBranchAccessParams {
  userId: string;
  branchId: string;
}

interface CreateOrganizationBody {
  name?: string;
  legalName?: string | null;
  gstNo?: string | null;
  panNo?: string | null;
  cinNo?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  baseCurrency?: string;
  fiscalCalendar?: string;
  status?: EnterpriseStatus;
  isDefault?: boolean;
  remarks?: string | null;
}

interface UpdateOrganizationBody extends CreateOrganizationBody {
  code?: string;
}

interface CreateBranchBody {
  name?: string;
  status?: EnterpriseStatus;
  isHeadOffice?: boolean;
  isDefault?: boolean;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  district?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  timezone?: string;
  remarks?: string | null;
}

interface UpdateBranchBody extends CreateBranchBody {
  code?: string;
}

interface UpdateUserBody {
  username?: string;
  email?: string;
  organizationId?: string | null;
  defaultBranchId?: string | null;
  status?: UserStatus;
}

const getTenantIdFromRequest = (request: FastifyRequest): string | null => request.tenantId ?? null;
const trimmed = (value: string | null | undefined): string | undefined => value?.trim() || undefined;

const coreEnterpriseRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: CreateOrganizationBody }>('/organizations', { preHandler: [requireAuth, requirePermission('organization.manage')] }, async (request, reply) => {
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) throw new ValidationError('Tenant context is required.');

    const body = request.body;
    const organization = await request.server.coreEnterpriseService.createOrganization(tenantId, {
      name: trimmed(body.name),
      legalName: trimmed(body.legalName),
      gstNo: trimmed(body.gstNo),
      panNo: trimmed(body.panNo),
      cinNo: trimmed(body.cinNo),
      email: trimmed(body.email),
      phone: trimmed(body.phone),
      website: trimmed(body.website),
      baseCurrency: trimmed(body.baseCurrency) ?? 'USD',
      fiscalCalendar: trimmed(body.fiscalCalendar) ?? 'standard',
      status: body.status ?? 'active',
      isDefault: body.isDefault ?? false,
      remarks: body.remarks ?? null,
    });

    reply.code(201);
    return { success: true, organization };
  });

  fastify.get('/organizations', { preHandler: [requireAuth, requirePermission('organization.read')] }, async (request) => {
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) throw new ValidationError('Tenant context is required.');

    const organizations = await request.server.coreEnterpriseService.listOrganizations(tenantId);
    return { success: true, organizations };
  });

  fastify.get<{ Params: IdParams }>('/organizations/:id', { preHandler: [requireAuth, requirePermission('organization.read')] }, async (request) => {
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) throw new ValidationError('Tenant context is required.');

    const organizationId = request.params.id.trim();
    const organization = await request.server.coreEnterpriseService.getOrganization(tenantId, organizationId);
    if (!organization) throw new NotFoundError('Organization not found.');

    return { success: true, organization };
  });

  fastify.patch<{ Params: IdParams; Body: UpdateOrganizationBody }>('/organizations/:id', { preHandler: [requireAuth, requirePermission('organization.manage')] }, async (request) => {
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) throw new ValidationError('Tenant context is required.');

    const body = request.body;
    const organizationId = request.params.id.trim();
    const updated = await request.server.coreEnterpriseService.updateOrganization(tenantId, organizationId, {
      code: body.code,
      name: body.name,
      legalName: body.legalName,
      gstNo: body.gstNo,
      panNo: body.panNo,
      cinNo: body.cinNo,
      email: body.email,
      phone: body.phone,
      website: body.website,
      baseCurrency: body.baseCurrency,
      fiscalCalendar: body.fiscalCalendar,
      status: body.status,
      isDefault: body.isDefault,
      remarks: body.remarks,
    });

    if (!updated) throw new NotFoundError('Organization not found.');
    return { success: true, organization: updated };
  });

  fastify.post<{ Params: IdParams }>('/organizations/:id/deactivate', { preHandler: [requireAuth, requirePermission('organization.manage')] }, async (request) => {
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) throw new ValidationError('Tenant context is required.');

    const organizationId = request.params.id.trim();
    const deactivated = await request.server.coreEnterpriseService.deactivateOrganization(tenantId, organizationId);
    if (!deactivated) throw new NotFoundError('Organization not found.');

    return { success: true, deactivated: true };
  });

  fastify.post<{ Params: OrganizationParams; Body: CreateBranchBody }>('/organizations/:organizationId/branches', { preHandler: [requireAuth, requirePermission('branch.manage')] }, async (request, reply) => {
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) throw new ValidationError('Tenant context is required.');

    const body = request.body;
    const organizationId = request.params.organizationId.trim();
    const branch = await request.server.coreEnterpriseService.createBranch(tenantId, organizationId, {
      name: trimmed(body.name),
      status: body.status ?? 'active',
      isHeadOffice: body.isHeadOffice ?? false,
      isDefault: body.isDefault ?? false,
      addressLine1: body.addressLine1 ?? null,
      addressLine2: body.addressLine2 ?? null,
      city: body.city ?? null,
      district: body.district ?? null,
      state: body.state ?? null,
      country: body.country ?? null,
      postalCode: body.postalCode ?? null,
      timezone: body.timezone ?? 'UTC',
      remarks: body.remarks ?? null,
    });

    reply.code(201);
    return { success: true, branch };
  });

  fastify.get<{ Params: OrganizationParams }>('/organizations/:organizationId/branches', { preHandler: [requireAuth, requirePermission('branch.read')] }, async (request) => {
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) throw new ValidationError('Tenant context is required.');

    const organizationId = request.params.organizationId.trim();
    const branches = await request.server.coreEnterpriseService.listBranches(tenantId, organizationId);
    return { success: true, branches };
  });

  fastify.get<{ Params: OrganizationBranchParams }>('/organizations/:organizationId/branches/:branchId', { preHandler: [requireAuth, requirePermission('branch.read')] }, async (request) => {
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) throw new ValidationError('Tenant context is required.');

    const organizationId = request.params.organizationId.trim();
    const branchId = request.params.branchId.trim();
    const branch = await request.server.coreEnterpriseService.getBranch(tenantId, organizationId, branchId);
    if (!branch) throw new NotFoundError('Branch not found.');
    return { success: true, branch };
  });

  fastify.patch<{ Params: OrganizationBranchParams; Body: UpdateBranchBody }>('/organizations/:organizationId/branches/:branchId', { preHandler: [requireAuth, requirePermission('branch.manage')] }, async (request) => {
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) throw new ValidationError('Tenant context is required.');

    const body = request.body;
    const organizationId = request.params.organizationId.trim();
    const branchId = request.params.branchId.trim();
    const updated = await request.server.coreEnterpriseService.updateBranch(tenantId, organizationId, branchId, {
      code: body.code,
      name: body.name,
      status: body.status,
      isHeadOffice: body.isHeadOffice,
      isDefault: body.isDefault,
      addressLine1: body.addressLine1,
      addressLine2: body.addressLine2,
      city: body.city,
      district: body.district,
      state: body.state,
      country: body.country,
      postalCode: body.postalCode,
      timezone: body.timezone,
      remarks: body.remarks,
    });

    if (!updated) throw new NotFoundError('Branch not found.');
    return { success: true, branch: updated };
  });

  fastify.post<{ Params: OrganizationBranchParams }>('/organizations/:organizationId/branches/:branchId/deactivate', { preHandler: [requireAuth, requirePermission('branch.manage')] }, async (request) => {
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) throw new ValidationError('Tenant context is required.');

    const organizationId = request.params.organizationId.trim();
    const branchId = request.params.branchId.trim();
    const deactivated = await request.server.coreEnterpriseService.deactivateBranch(tenantId, organizationId, branchId);
    if (!deactivated) throw new NotFoundError('Branch not found.');

    return { success: true, deactivated: true };
  });

  fastify.get('/users', { preHandler: [requireAuth, requirePermission('user.read')] }, async (request) => {
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) throw new ValidationError('Tenant context is required.');

    const users = await request.server.coreEnterpriseService.listUsers(tenantId);
    return { success: true, users };
  });

  fastify.get<{ Params: IdParams }>('/users/:id', { preHandler: [requireAuth, requirePermission('user.read')] }, async (request) => {
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) throw new ValidationError('Tenant context is required.');

    const userId = request.params.id.trim();
    const user = await request.server.coreEnterpriseService.getUser(tenantId, userId);
    if (!user) throw new NotFoundError('User not found.');

    return { success: true, user };
  });

  fastify.get<{ Params: IdParams }>('/users/:id/access', { preHandler: [requireAuth, requirePermission('user.manage')] }, async (request) => {
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) throw new ValidationError('Tenant context is required.');

    const userId = request.params.id.trim();
    const user = await request.server.coreEnterpriseService.getUser(tenantId, userId);
    if (!user) throw new NotFoundError('User not found.');

    const access = await request.server.coreEnterpriseService.getUserAccess(tenantId, userId);
    return { success: true, userId, organizations: access.organizations, branches: access.branches };
  });

  fastify.patch<{ Params: IdParams; Body: UpdateUserBody }>('/users/:id', { preHandler: [requireAuth, requirePermission('user.manage')] }, async (request) => {
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) throw new ValidationError('Tenant context is required.');

    const userId = request.params.id.trim();
    const body = request.body;
    const updated = await request.server.coreEnterpriseService.updateUser(tenantId, userId, {
      username: body.username,
      email: body.email,
      organizationId: body.organizationId,
      defaultBranchId: body.defaultBranchId,
      status: body.status,
    });

    if (!updated) throw new NotFoundError('User not found.');
    return { success: true, user: updated };
  });

  fastify.post<{ Params: UserOrganizationAccessParams }>('/users/:userId/organizations/:organizationId/access', { preHandler: [requireAuth, requirePermission('user.manage')] }, async (request) => {
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) throw new ValidationError('Tenant context is required.');

    const userId = request.params.userId.trim();
    const organizationId = request.params.organizationId.trim();
    const assigned = await request.server.coreEnterpriseService.assignUserToOrganization(tenantId, userId, organizationId);
    if (!assigned) throw new NotFoundError('User or organization not found.');

    return { success: true, assigned: true };
  });

  fastify.post<{ Params: UserBranchAccessParams }>('/users/:userId/branches/:branchId/access', { preHandler: [requireAuth, requirePermission('user.manage')] }, async (request) => {
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) throw new ValidationError('Tenant context is required.');

    const userId = request.params.userId.trim();
    const branchId = request.params.branchId.trim();
    const assigned = await request.server.coreEnterpriseService.assignUserToBranch(tenantId, userId, branchId);
    if (!assigned) throw new NotFoundError('User or branch not found.');

    return { success: true, assigned: true };
  });

  fastify.post<{ Params: IdParams }>('/users/:id/activate', { preHandler: [requireAuth, requirePermission('user.manage')] }, async (request) => {
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) throw new ValidationError('Tenant context is required.');

    const userId = request.params.id.trim();
    const activated = await request.server.coreEnterpriseService.activateUser(tenantId, userId);
    if (!activated) throw new NotFoundError('User not found.');

    return { success: true, activated: true };
  });

  fastify.post<{ Params: IdParams }>('/users/:id/deactivate', { preHandler: [requireAuth, requirePermission('user.manage')] }, async (request) => {
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) throw new ValidationError('Tenant context is required.');

    const userId = request.params.id.trim();
    const deactivated = await request.server.coreEnterpriseService.deactivateUser(tenantId, userId);
    if (!deactivated) throw new NotFoundError('User not found.');

    return { success: true, deactivated: true };
  });
};

export default coreEnterpriseRoutes;
