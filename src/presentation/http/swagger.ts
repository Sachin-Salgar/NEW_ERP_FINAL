import { z } from 'zod';
import { FastifyInstance } from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import { zodToJsonSchema } from 'zod-to-json-schema';

export function toJsonSchema(schema: z.ZodTypeAny, name?: string) {
  return zodToJsonSchema(schema, {
    name,
    $refStrategy: 'none',
  });
}

const idParams = (names: string[]) =>
  z.object(Object.fromEntries(names.map((name) => [name, name === 'code' ? z.string().min(1) : z.string().uuid()])));

export function schemaForRoute(method: string, url: string) {
  const normalizedUrl = url.replace(/^\/(?:api\/v\d+\/)?/, '/');
  const params = [...normalizedUrl.matchAll(/:([A-Za-z0-9_]+)/g)].map((match) => match[1]);
  const schema: { params?: object; body?: object; querystring?: object } = {};
  if (params.length > 0) schema.params = toJsonSchema(idParams(params));

  if (method === 'POST' && normalizedUrl === '/auth/register') schema.body = toJsonSchema(authSchemas.registerRequest);
  else if (method === 'POST' && normalizedUrl === '/auth/login') schema.body = toJsonSchema(authSchemas.loginRequest);
  else if (method === 'POST' && normalizedUrl === '/auth/refresh')
    schema.body = toJsonSchema(authSchemas.refreshRequest);
  else if (method === 'POST' && normalizedUrl === '/auth/organizations/select')
    schema.body = toJsonSchema(authSchemas.orgSelectRequest);
  else if (method === 'POST' && normalizedUrl === '/auth/context/select')
    schema.body = toJsonSchema(authSchemas.contextSelectRequest);
  else if (method === 'POST' && normalizedUrl === '/organizations')
    schema.body = toJsonSchema(enterpriseSchemas.createOrganizationRequest);
  else if (method === 'PATCH' && normalizedUrl === '/organizations/:id')
    schema.body = toJsonSchema(enterpriseSchemas.createOrganizationRequest.partial());
  else if (method === 'POST' && normalizedUrl.endsWith('/branches'))
    schema.body = toJsonSchema(enterpriseSchemas.createBranchRequest);
  else if (method === 'PATCH' && normalizedUrl.match(/^\/organizations\/:organizationId\/branches\/:branchId$/))
    schema.body = toJsonSchema(enterpriseSchemas.createBranchRequest.partial());
  else if (method === 'POST' && normalizedUrl === '/locations')
    schema.body = toJsonSchema(locationSchemas.createLocationRequest);
  else if (method === 'PATCH' && normalizedUrl === '/locations/:id')
    schema.body = toJsonSchema(locationSchemas.createLocationRequest.partial());
  else if (method === 'POST' && normalizedUrl === '/rbac/roles')
    schema.body = toJsonSchema(rbacSchemas.createRoleRequest);
  else if (method === 'PATCH' && normalizedUrl === '/rbac/roles/:roleId')
    schema.body = toJsonSchema(rbacSchemas.updateRoleRequest);
  else if (method === 'POST' && normalizedUrl.endsWith('/permissions'))
    schema.body = toJsonSchema(rbacSchemas.assignPermissionsRequest);
  else if (method === 'PUT' && normalizedUrl.endsWith('/permissions'))
    schema.body = toJsonSchema(rbacSchemas.assignPermissionsRequest);
  else if (method === 'POST' && normalizedUrl.endsWith('/roles'))
    schema.body = toJsonSchema(rbacSchemas.assignRoleRequest);
  else if (method === 'DELETE' && normalizedUrl.endsWith('/permissions'))
    schema.body = toJsonSchema(rbacSchemas.assignPermissionsRequest);
  else if (method === 'PATCH' && normalizedUrl === '/users/:id')
    schema.body = toJsonSchema(
      z.object({
        username: z.string().min(1).optional(),
        email: z.string().email().optional(),
        organizationId: z.string().nullable().optional(),
        defaultBranchId: z.string().nullable().optional(),
        status: z.enum(['active', 'inactive', 'locked', 'pending_verification']).optional(),
      }),
    );
  else if (method === 'POST' && normalizedUrl === '/customers')
    schema.body = toJsonSchema(customerSchemas.createRequest);
  else if (method === 'PATCH' && normalizedUrl === '/customers/:id')
    schema.body = toJsonSchema(customerSchemas.updateRequest);
  else if (method === 'POST' && normalizedUrl === '/sales/quotations')
    schema.body = toJsonSchema(salesQuotationSchemas.createRequest);
  else if (method === 'PATCH' && normalizedUrl === '/sales/quotations/:id')
    schema.body = toJsonSchema(salesQuotationSchemas.updateRequest);
  else if (method === 'POST' && normalizedUrl === '/sales/orders')
    schema.body = toJsonSchema(z.object({ quotationId: z.string().uuid(), warehouseId: z.string().uuid() }));
  else if (method === 'PATCH' && normalizedUrl === '/sales/orders/:id')
    schema.body = toJsonSchema(
      z.object({ notes: z.string().nullable().optional(), expectedVersion: z.number().int().positive() }),
    );
  else if (method === 'POST' && normalizedUrl.match(/^\/sales\/orders\/:id\/(confirm|cancel|close)$/))
    schema.body = toJsonSchema(z.object({ expectedVersion: z.number().int().positive() }));
  return schema;
}

export const securityScheme = {
  bearerAuth: {
    type: 'http' as const,
    scheme: 'bearer',
    bearerFormat: 'JWT',
  },
};

export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string(),
    timestamp: z.string(),
    details: z.unknown().optional(),
  }),
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1).describe('Page number (1-based)'),
  limit: z.coerce.number().int().positive().max(100).default(20).describe('Items per page (max 100)'),
  cursor: z.string().optional().describe('Opaque cursor for keyset pagination'),
});

export const paginationMetaSchema = z.object({
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative().optional(),
  nextCursor: z.string().optional(),
});

export const paginatedResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: z.array(dataSchema),
    meta: paginationMetaSchema,
  });

export const authSchemas = {
  loginRequest: z.object({
    identifier: z.string().min(1).describe('Username or email'),
    password: z.string().min(1).describe('Password'),
  }),
  loginResponse: z.object({
    success: z.boolean().describe('Always true'),
    user: z.object({
      id: z.string().uuid(),
      tenantId: z.string().uuid(),
      organizationId: z.string().uuid().nullable(),
      activeLocationId: z.string().uuid().nullable(),
      defaultLocationId: z.string().uuid().nullable(),
      defaultBranchId: z.string().uuid().nullable(),
      username: z.string(),
      email: z.string().email(),
      status: z.string(),
    }),
    session: z.object({
      id: z.string().uuid(),
      tenantId: z.string().uuid(),
      userId: z.string().uuid(),
      organizationId: z.string().uuid().nullable(),
      locationId: z.string().uuid().nullable(),
      branchId: z.string().uuid().nullable(),
      isActive: z.boolean(),
      expiresAt: z.string().datetime(),
      loginAt: z.string().datetime(),
    }),
    accessToken: z.string().describe('JWT access token (1 hour expiry)'),
    refreshToken: z.string().describe('Refresh token (14 days expiry)'),
    expiresAt: z.string().datetime(),
    tokenType: z.string().describe('Always "bearer"'),
    tenant: z.object({ id: z.string().uuid() }),
    organizations: z.array(
      z.object({
        id: z.string().uuid(),
        tenantId: z.string().uuid(),
        code: z.string(),
        name: z.string(),
        status: z.string(),
        isDefault: z.boolean(),
      }),
    ),
    activeOrganizationId: z.string().uuid().nullable(),
    requiresOrganizationSelection: z.boolean(),
  }),
  registerRequest: z.object({
    username: z.string().min(3).max(150),
    email: z.string().email(),
    password: z.string().min(8).max(128),
    organizationId: z.string().uuid().optional(),
    defaultBranchId: z.string().uuid().optional(),
    defaultLocationId: z.string().uuid().optional(),
    roleCode: z.string().min(1).max(50).optional(),
  }),
  refreshRequest: z.object({
    refreshToken: z.string().min(1),
  }),
  refreshResponse: z.object({
    success: z.boolean().describe('Always true'),
    accessToken: z.string(),
    expiresAt: z.string().datetime(),
    tokenType: z.string().describe('Always "bearer"'),
    user: z.object({
      id: z.string().uuid(),
      tenantId: z.string().uuid(),
      organizationId: z.string().uuid().nullable(),
      activeLocationId: z.string().uuid().nullable(),
      defaultLocationId: z.string().uuid().nullable(),
      defaultBranchId: z.string().uuid().nullable(),
      username: z.string(),
      email: z.string().email(),
      status: z.string(),
    }),
  }),
  meResponse: z.object({
    success: z.boolean().describe('Always true'),
    user: z.object({
      id: z.string().uuid(),
      tenantId: z.string().uuid(),
      organizationId: z.string().uuid().nullable(),
      activeLocationId: z.string().uuid().nullable(),
      defaultLocationId: z.string().uuid().nullable(),
      defaultBranchId: z.string().uuid().nullable(),
      username: z.string(),
      email: z.string().email(),
      status: z.string(),
    }),
  }),
  orgSelectRequest: z.object({
    organizationId: z.string().min(1),
  }),
  orgSelectResponse: z.object({
    success: z.boolean().describe('Always true'),
    user: z.object({
      id: z.string().uuid(),
      tenantId: z.string().uuid(),
      organizationId: z.string().uuid().nullable(),
      activeLocationId: z.string().uuid().nullable(),
      defaultLocationId: z.string().uuid().nullable(),
      defaultBranchId: z.string().uuid().nullable(),
      username: z.string(),
      email: z.string().email(),
      status: z.string(),
    }),
    session: z.object({
      id: z.string().uuid(),
      tenantId: z.string().uuid(),
      userId: z.string().uuid(),
      organizationId: z.string().uuid().nullable(),
      locationId: z.string().uuid().nullable(),
      branchId: z.string().uuid().nullable(),
      isActive: z.boolean(),
      expiresAt: z.string().datetime(),
      loginAt: z.string().datetime(),
    }),
    accessToken: z.string(),
    refreshToken: z.string(),
    expiresAt: z.string().datetime(),
    tokenType: z.string().describe('Always "bearer"'),
  }),
  contextSelectRequest: z.object({
    organizationId: z.string().uuid(),
    branchId: z.string().uuid(),
    locationId: z.string().uuid(),
    financialYearId: z.string().uuid().optional(),
  }),
  contextSelectResponse: z.object({
    success: z.boolean().describe('Always true'),
    user: z.object({
      id: z.string().uuid(),
      tenantId: z.string().uuid(),
      organizationId: z.string().uuid().nullable(),
      activeLocationId: z.string().uuid().nullable(),
      defaultLocationId: z.string().uuid().nullable(),
      defaultBranchId: z.string().uuid().nullable(),
      username: z.string(),
      email: z.string().email(),
      status: z.string(),
    }),
    session: z.object({
      id: z.string().uuid(),
      tenantId: z.string().uuid(),
      userId: z.string().uuid(),
      organizationId: z.string().uuid().nullable(),
      locationId: z.string().uuid().nullable(),
      branchId: z.string().uuid().nullable(),
      isActive: z.boolean(),
      expiresAt: z.string().datetime(),
      loginAt: z.string().datetime(),
    }),
    branch: z.object({
      id: z.string().uuid(),
      tenantId: z.string().uuid(),
      organizationId: z.string().uuid(),
      code: z.string(),
      name: z.string(),
      status: z.string(),
      isHeadOffice: z.boolean(),
      isDefault: z.boolean(),
    }),
    location: z.object({
      id: z.string().uuid(),
      tenantId: z.string().uuid(),
      organizationId: z.string().uuid(),
      code: z.string(),
      name: z.string(),
      description: z.string().nullable(),
      status: z.string(),
      isDefault: z.boolean(),
    }),
    accessToken: z.string(),
    refreshToken: z.string(),
    expiresAt: z.string().datetime(),
    tokenType: z.string().describe('Always "bearer"'),
  }),
  modulesResponse: z.object({
    success: z.boolean().describe('Always true'),
    organizationId: z.string().uuid(),
    modules: z.array(
      z.object({
        id: z.string().uuid(),
        code: z.string(),
        name: z.string(),
        moduleGroup: z.string(),
        description: z.string().nullable(),
        icon: z.string().nullable(),
        route: z.string().nullable(),
        isCore: z.boolean(),
        sortOrder: z.number(),
        enabled: z.boolean(),
      }),
    ),
  }),
  moduleToggleResponse: z.object({
    success: z.boolean().describe('Always true'),
    enabled: z.boolean(),
    module: z
      .object({
        id: z.string().uuid(),
        code: z.string(),
        name: z.string(),
        moduleGroup: z.string(),
        description: z.string().nullable(),
        icon: z.string().nullable(),
        route: z.string().nullable(),
        isCore: z.boolean(),
        sortOrder: z.number(),
        enabled: z.boolean(),
      })
      .optional(),
    moduleCode: z.string().optional(),
  }),
  logoutResponse: z.object({
    success: z.boolean().describe('Always true'),
    message: z.string(),
  }),
  bootstrapResponse: z.object({
    success: z.boolean().describe('Always true'),
    deployment: z.object({
      apiVersion: z.string(),
      environment: z.string(),
    }),
    login: z.object({ enabled: z.boolean() }),
    capabilities: z.object({
      apiVersion: z.string(),
      tenantSelection: z.boolean(),
      multiOrganization: z.boolean(),
      workingContextSelection: z.boolean(),
    }),
  }),
};

export const healthSchemas = {
  healthResponse: z.object({
    status: z.string().describe('Always "ok"'),
    timestamp: z.string().datetime(),
    uptime: z.number().describe('Process uptime in seconds'),
    memory: z.object({
      rss: z.number(),
      heapUsed: z.number(),
      heapTotal: z.number(),
      external: z.number(),
    }),
    database: z.object({
      connected: z.boolean(),
      latencyMs: z.number().optional(),
      pool: z
        .object({
          total: z.number(),
          idle: z.number(),
          waiting: z.number(),
        })
        .optional(),
    }),
    migrations: z
      .object({
        applied: z.array(z.string()),
        pending: z.array(z.string()),
      })
      .optional(),
  }),
};

export const rbacSchemas = {
  role: z.object({
    id: z.string().uuid(),
    tenantId: z.string().uuid(),
    code: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    isSystem: z.boolean(),
    sortOrder: z.number(),
    createdAt: z.string().datetime().nullable(),
    updatedAt: z.string().datetime().nullable(),
  }),
  createRoleRequest: z.object({
    code: z.string().min(1).max(50),
    name: z.string().min(1).max(100),
    description: z.string().nullable().optional(),
    isSystem: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
  }),
  updateRoleRequest: z.object({
    code: z.string().min(1).max(50).optional(),
    name: z.string().min(1).max(100).optional(),
    description: z.string().nullable().optional(),
    isSystem: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
  }),
  permission: z.object({
    id: z.string().uuid(),
    moduleCode: z.string(),
    resource: z.string(),
    action: z.string(),
    scope: z.enum(['own', 'branch', 'organization', 'tenant', 'global']),
    permissionKey: z.string(),
    displayName: z.string(),
    description: z.string().nullable(),
    isSystem: z.boolean(),
  }),
  assignPermissionsRequest: z.object({
    permissionKeys: z.array(z.string().min(1)).min(1),
  }),
  rolePermissionsResponse: z.object({
    success: z.boolean().describe('Always true'),
    permissions: z.array(
      z.object({
        id: z.string().uuid(),
        moduleCode: z.string(),
        resource: z.string(),
        action: z.string(),
        scope: z.enum(['own', 'branch', 'organization', 'tenant', 'global']),
        permissionKey: z.string(),
        displayName: z.string(),
        description: z.string().nullable(),
        isSystem: z.boolean(),
      }),
    ),
  }),
  userRolesResponse: z.object({
    success: z.boolean().describe('Always true'),
    roles: z.array(
      z.object({
        id: z.string().uuid(),
        tenantId: z.string().uuid(),
        code: z.string(),
        name: z.string(),
        description: z.string().nullable(),
        isSystem: z.boolean(),
        sortOrder: z.number(),
        createdAt: z.string().datetime().nullable(),
        updatedAt: z.string().datetime().nullable(),
      }),
    ),
  }),
  userEffectivePermissionsResponse: z.object({
    success: z.boolean().describe('Always true'),
    permissions: z.array(
      z.object({
        id: z.string().uuid(),
        moduleCode: z.string(),
        resource: z.string(),
        action: z.string(),
        scope: z.enum(['own', 'branch', 'organization', 'tenant', 'global']),
        permissionKey: z.string(),
        displayName: z.string(),
        description: z.string().nullable(),
        isSystem: z.boolean(),
      }),
    ),
  }),
  assignRoleRequest: z.object({
    roleId: z.string().uuid(),
  }),
};

export const enterpriseSchemas = {
  organization: z.object({
    id: z.string().uuid(),
    tenantId: z.string().uuid(),
    code: z.string(),
    name: z.string(),
    legalName: z.string().nullable(),
    gstNo: z.string().nullable(),
    panNo: z.string().nullable(),
    cinNo: z.string().nullable(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    website: z.string().nullable(),
    baseCurrency: z.string(),
    fiscalCalendar: z.string(),
    status: z.enum(['active', 'inactive', 'archived']),
    isDefault: z.boolean(),
    remarks: z.string().nullable(),
    createdAt: z.string().datetime().nullable(),
    updatedAt: z.string().datetime().nullable(),
  }),
  createOrganizationRequest: z.object({
    code: z.string().min(1).max(50).optional(),
    name: z.string().min(1).max(255),
    legalName: z.string().max(255).nullable().optional(),
    gstNo: z.string().max(50).nullable().optional(),
    panNo: z.string().max(50).nullable().optional(),
    cinNo: z.string().max(50).nullable().optional(),
    email: z.string().email().nullable().optional(),
    phone: z.string().max(50).nullable().optional(),
    website: z.string().max(255).nullable().optional(),
    baseCurrency: z.string().length(3).optional(),
    fiscalCalendar: z.string().max(50).optional(),
    status: z.enum(['active', 'inactive', 'archived']).optional(),
    isDefault: z.boolean().optional(),
    remarks: z.string().nullable().optional(),
  }),
  branch: z.object({
    id: z.string().uuid(),
    tenantId: z.string().uuid(),
    organizationId: z.string().uuid(),
    code: z.string(),
    name: z.string(),
    status: z.enum(['active', 'inactive', 'archived']),
    isHeadOffice: z.boolean(),
    isDefault: z.boolean(),
    addressLine1: z.string().nullable(),
    addressLine2: z.string().nullable(),
    city: z.string().nullable(),
    district: z.string().nullable(),
    state: z.string().nullable(),
    country: z.string().nullable(),
    postalCode: z.string().nullable(),
    timezone: z.string(),
    remarks: z.string().nullable(),
    createdAt: z.string().datetime().nullable(),
    updatedAt: z.string().datetime().nullable(),
  }),
  createBranchRequest: z.object({
    code: z.string().min(1).max(50).optional(),
    name: z.string().min(1).max(255),
    status: z.enum(['active', 'inactive', 'archived']).optional(),
    isHeadOffice: z.boolean().optional(),
    isDefault: z.boolean().optional(),
    addressLine1: z.string().nullable().optional(),
    addressLine2: z.string().nullable().optional(),
    city: z.string().max(100).nullable().optional(),
    district: z.string().max(100).nullable().optional(),
    state: z.string().max(100).nullable().optional(),
    country: z.string().max(100).nullable().optional(),
    postalCode: z.string().max(20).nullable().optional(),
    timezone: z.string().optional(),
    remarks: z.string().nullable().optional(),
  }),
};

export const customerSchemas = {
  customer: z.object({
    id: z.string().uuid(),
    organizationId: z.string().uuid(),
    name: z.string().min(1).max(255),
    createdAt: z.string().datetime(),
    createdBy: z.string().uuid().nullable(),
    updatedAt: z.string().datetime().nullable(),
    updatedBy: z.string().uuid().nullable(),
    deletedAt: z.string().datetime().nullable(),
    deletedBy: z.string().uuid().nullable(),
    isDeleted: z.boolean(),
    version: z.number().int().positive(),
  }),
  createRequest: z.object({
    organizationId: z.string().uuid(),
    name: z.string().trim().min(1).max(255),
  }),
  updateRequest: z.object({
    name: z.string().trim().min(1).max(255),
  }),
};

export const salesQuotationSchemas = {
  item: z.object({
    lineNumber: z.number().int().positive().optional(),
    itemCode: z.string().trim().min(1).max(100).nullable().optional(),
    description: z.string().trim().min(1).max(500),
    quantity: z.number().positive(),
    unitPrice: z.number().nonnegative(),
    unitOfMeasure: z.string().trim().min(1).max(50),
  }),
  quotation: z.object({
    id: z.string().uuid(),
    tenantId: z.string().uuid(),
    organizationId: z.string().uuid(),
    quotationNumber: z.string(),
    customerId: z.string().uuid(),
    quotationDate: z.string().date(),
    validUntil: z.string().date(),
    status: z.enum(['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED']),
    notes: z.string().nullable(),
    subtotal: z.number(),
    discountTotal: z.number(),
    total: z.number(),
    items: z.array(
      z.object({
        id: z.string().uuid(),
        lineNumber: z.number().int().positive(),
        description: z.string(),
        quantity: z.number(),
        unitPrice: z.number(),
        unitOfMeasure: z.string(),
      }),
    ),
  }),
  createRequest: z.object({
    customerId: z.string().uuid(),
    quotationDate: z.string().date(),
    validUntil: z.string().date(),
    notes: z.string().nullable().optional(),
    items: z
      .array(
        z.object({
          lineNumber: z.number().int().positive().optional(),
          itemId: z.string().uuid().nullable().optional(),
          itemCode: z.string().trim().min(1).max(100).nullable().optional(),
          description: z.string().trim().min(1).max(500),
          quantity: z.number().positive(),
          unitPrice: z.number().nonnegative(),
          unitOfMeasure: z.string().trim().min(1).max(50),
        }),
      )
      .min(1),
  }),
  updateRequest: z.object({
    customerId: z.string().uuid(),
    quotationDate: z.string().date(),
    validUntil: z.string().date(),
    notes: z.string().nullable().optional(),
    items: z
      .array(
        z.object({
          lineNumber: z.number().int().positive().optional(),
          itemId: z.string().uuid().nullable().optional(),
          itemCode: z.string().trim().min(1).max(100).nullable().optional(),
          description: z.string().trim().min(1).max(500),
          quantity: z.number().positive(),
          unitPrice: z.number().nonnegative(),
          unitOfMeasure: z.string().trim().min(1).max(50),
        }),
      )
      .min(1),
  }),
};

export const locationSchemas = {
  location: z.object({
    id: z.string().uuid(),
    tenantId: z.string().uuid(),
    organizationId: z.string().uuid(),
    code: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    status: z.enum(['active', 'inactive', 'archived']),
    isDefault: z.boolean(),
    addressLine1: z.string().nullable(),
    addressLine2: z.string().nullable(),
    city: z.string().nullable(),
    state: z.string().nullable(),
    country: z.string().nullable(),
    postalCode: z.string().nullable(),
    timezone: z.string(),
    createdAt: z.string().datetime().nullable(),
    updatedAt: z.string().datetime().nullable(),
  }),
  createLocationRequest: z.object({
    code: z.string().min(1).max(50).optional(),
    organizationId: z.string().uuid().optional(),
    name: z.string().min(1).max(255),
    description: z.string().nullable().optional(),
    status: z.enum(['active', 'inactive', 'archived']).optional(),
    isDefault: z.boolean().optional(),
    addressLine1: z.string().nullable().optional(),
    addressLine2: z.string().nullable().optional(),
    city: z.string().max(100).nullable().optional(),
    state: z.string().max(100).nullable().optional(),
    country: z.string().max(100).nullable().optional(),
    postalCode: z.string().max(20).nullable().optional(),
    timezone: z.string().optional(),
  }),
};

export async function setupSwagger(app: FastifyInstance) {
  // @ts-expect-error - Fastify v5 types don't properly support callback-based plugins, but runtime works
  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'NEW ERP Final API',
        description: 'Enterprise ERP System REST API v1',
        version: '1.0.0',
        contact: {
          name: 'Architecture Team',
          email: 'architecture@example.com',
        },
        license: {
          name: 'Proprietary',
        },
      },
      servers: [{ url: 'http://localhost:3000/api/v1', description: 'Development server' }],
      components: {
        securitySchemes: securityScheme,
        schemas: {
          ErrorResponse: toJsonSchema(errorResponseSchema),
          PaginationQuery: toJsonSchema(paginationQuerySchema),
          PaginationMeta: toJsonSchema(paginationMetaSchema),
          ...Object.fromEntries(Object.entries(authSchemas).map(([k, v]) => [k, toJsonSchema(v)])),
          ...Object.fromEntries(Object.entries(healthSchemas).map(([k, v]) => [k, toJsonSchema(v)])),
          ...Object.fromEntries(Object.entries(rbacSchemas).map(([k, v]) => [k, toJsonSchema(v)])),
          ...Object.fromEntries(Object.entries(enterpriseSchemas).map(([k, v]) => [k, toJsonSchema(v)])),
          ...Object.fromEntries(Object.entries(locationSchemas).map(([k, v]) => [k, toJsonSchema(v)])),
          ...Object.fromEntries(Object.entries(customerSchemas).map(([k, v]) => [k, toJsonSchema(v)])),
          ...Object.fromEntries(Object.entries(salesQuotationSchemas).map(([k, v]) => [k, toJsonSchema(v)])),
        },
      },
      security: [{ bearerAuth: [] }],
      tags: [
        { name: 'Bootstrap', description: 'Deployment bootstrap information' },
        { name: 'Authentication', description: 'Authentication and session management' },
        { name: 'Health', description: 'System health and readiness checks' },
        { name: 'RBAC', description: 'Role-based access control' },
        { name: 'Enterprise', description: 'Organization and branch management' },
        { name: 'Locations', description: 'Location management' },
        { name: 'Customers', description: 'Customer management' },
        { name: 'Sales Quotations', description: 'Sales quotation management' },
      ],
    },
  });

  await app.register(fastifySwaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      displayRequestDuration: true,
      filter: true,
    },
    staticCSP: true,
    transformStaticCSP: (header: string) => header.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'"),
  });

  app.log.info('Swagger UI available at /docs');
}
