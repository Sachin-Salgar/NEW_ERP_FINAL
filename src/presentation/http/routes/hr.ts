import type { FastifyPluginAsync, FastifyRequest } from 'fastify';

import { ValidationError } from '../../../domain/errors.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { parsePaginationQuery } from '../pagination.js';
import { requestParam } from '../request-input.js';

const context = (request: FastifyRequest) => {
  if (!request.user?.tenantId || !request.tenantId) {
    throw new ValidationError('Authenticated tenant context is required.');
  }
  return {
    tenantId: request.tenantId,
    userId: request.user.id,
    branchId: request.user.branchId ?? null,
  };
};

const hrRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/hr/:resource',
    { preHandler: [requireAuth] },
    async (request) => {
      const query = request.query as { search?: string };
      const pagination = parsePaginationQuery(request.query);
      const result = await fastify.hrService.list(
        context(request),
        requestParam(request.params, 'resource') ?? '',
        pagination.page,
        pagination.pageSize,
        query.search,
      );
      return {
        success: true,
        items: result.items,
        total: result.total,
      };
    },
  );

  fastify.get(
    '/hr/:resource/:id',
    { preHandler: [requireAuth] },
    async (request) => ({
      success: true,
      record: await fastify.hrService.get(
        context(request),
        requestParam(request.params, 'resource') ?? '',
        requestParam(request.params, 'id') ?? '',
      ),
    }),
  );

  fastify.post(
    '/hr/:resource',
    { preHandler: [requireAuth] },
    async (request) => ({
      success: true,
      record: await fastify.hrService.create(
        context(request),
        requestParam(request.params, 'resource') ?? '',
        request.body as Record<string, unknown>,
      ),
    }),
  );

  fastify.patch(
    '/hr/:resource/:id',
    { preHandler: [requireAuth] },
    async (request) => ({
      success: true,
      record: await fastify.hrService.update(
        context(request),
        requestParam(request.params, 'resource') ?? '',
        requestParam(request.params, 'id') ?? '',
        request.body as Record<string, unknown>,
      ),
    }),
  );

  fastify.delete(
    '/hr/:resource/:id',
    { preHandler: [requireAuth] },
    async (request) => ({
      success: true,
      record: await fastify.hrService.remove(
        context(request),
        requestParam(request.params, 'resource') ?? '',
        requestParam(request.params, 'id') ?? '',
      ),
    }),
  );

  fastify.post(
    '/hr/employees/:id/grant-access',
    {
      preHandler: [
        requireAuth,
        requirePermission('hr.employee.grant_access'),
        requirePermission('user.create'),
      ],
    },
    async (request) => {
      const body = request.body as Record<string, unknown>;
      const registration = await fastify.registrationService.registerUser(
        request.tenantId!,
        request.user!.id,
        {
          username: String(body.username),
          email: String(body.email),
          password: String(body.password),
          defaultBranchId:
              body.defaultBranchId ?? request.user!.branchId ?? null,
          roleCode: body.roleCode ?? 'member',
        },
      );
      const employee = await fastify.hrService.linkUser(
        context(request),
        requestParam(request.params, 'id') ?? '',
        registration.id,
      );
      return { success: true, user: registration, employee };
    },
  );

  fastify.post(
    '/hr/attendance/:employeeId/check-in',
    { preHandler: [requireAuth] },
    async (request) => ({
      success: true,
      attendance: await fastify.hrService.punch(
        context(request),
        requestParam(request.params, 'employeeId') ?? '',
        'IN',
        (request.body as { at?: string })?.at,
      ),
    }),
  );

  fastify.post(
    '/hr/attendance/:employeeId/check-out',
    { preHandler: [requireAuth] },
    async (request) => ({
      success: true,
      attendance: await fastify.hrService.punch(
        context(request),
        requestParam(request.params, 'employeeId') ?? '',
        'OUT',
        (request.body as { at?: string })?.at,
      ),
    }),
  );

  fastify.post(
    '/hr/payroll-runs/:id/calculate',
    { preHandler: [requireAuth] },
    async (request) => ({
      success: true,
      payrollRun: await fastify.hrService.calculatePayroll(
        context(request),
        requestParam(request.params, 'id') ?? '',
      ),
    }),
  );
};

export default hrRoutes;
