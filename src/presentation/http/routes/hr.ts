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
            typeof body.defaultBranchId === 'string'
              ? body.defaultBranchId
              : request.user!.branchId ?? null,
          roleCode:
            typeof body.roleCode === 'string' ? body.roleCode : 'member',
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
    '/hr/:resource/:id/submit',
    { preHandler: [requireAuth] },
    async (request) => {
      const body = (request.body ?? {}) as { expectedVersion?: number };
      return {
        success: true,
        workflow: await fastify.hrService.submitForApproval(
          context(request),
          requestParam(request.params, 'resource') ?? '',
          requestParam(request.params, 'id') ?? '',
          typeof body.expectedVersion === 'number' ? body.expectedVersion : 1,
        ),
      };
    },
  );

  fastify.post(
    '/hr/employees/:id/leave-balances/initialize',
    { preHandler: [requireAuth] },
    async (request) => {
      const body = (request.body ?? {}) as { year?: number };
      const year = typeof body.year === 'number' ? body.year : new Date().getUTCFullYear();
      return {
        success: true,
        balances: await fastify.hrService.initializeLeaveBalances(
          context(request),
          requestParam(request.params, 'id') ?? '',
          year,
        ),
      };
    },
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
  fastify.post('/hr/payroll-runs/:id/close',{preHandler:[requireAuth]},async request=>({success:true,payrollRun:await fastify.hrService.closePayroll(context(request),requestParam(request.params,'id')??'')}));
  fastify.post('/hr/attendance/:id/finalize',{preHandler:[requireAuth]},async request=>({success:true,attendance:await fastify.hrService.finalizeAttendance(context(request),requestParam(request.params,'id')??'')}));
  fastify.post('/hr/employees/:id/exit',{preHandler:[requireAuth]},async request=>{const body=request.body as Record<string,unknown>;return{success:true,employee:await fastify.hrService.employeeExit(context(request),requestParam(request.params,'id')??'',String(body.exitDate??''),typeof body.reason==='string'?body.reason:undefined)};});
  fastify.post('/hr/payroll-runs/:id/approve',{preHandler:[requireAuth]},async request=>({success:true,payrollRun:await fastify.hrService.approvePayroll(context(request),requestParam(request.params,'id')??'')}));
  fastify.post('/hr/payroll-runs/:id/post-finance',{preHandler:[requireAuth]},async request=>({success:true,posting:await fastify.hrService.postPayrollToFinance(context(request),requestParam(request.params,'id')??'')}));
  fastify.post('/hr/leave/accrual',{preHandler:[requireAuth]},async request=>{const body=request.body as {year?:number};return{success:true,run:await fastify.hrService.runLeaveAccrual(context(request),Number(body.year))};});
  fastify.post('/hr/leave/encash',{preHandler:[requireAuth]},async request=>{const b=request.body as Record<string,unknown>;return{success:true,encashment:await fastify.hrService.encashLeave(context(request),String(b.employeeId),String(b.leaveTypeId),Number(b.year),Number(b.days),Number(b.amount))};});
  fastify.post('/hr/attendance-regularizations/:id/approve',{preHandler:[requireAuth]},async request=>({success:true,regularization:await fastify.hrService.approveAttendanceRegularization(context(request),requestParam(request.params,'id')??'')}));
  fastify.post('/hr/overtime',{preHandler:[requireAuth]},async request=>{const b=request.body as Record<string,unknown>;return{success:true,overtime:await fastify.hrService.calculateOvertime(context(request),String(b.employeeId),String(b.attendanceId),Number(b.minutes),Number(b.rate))};});
  fastify.post('/hr/job-offers/:id/accept',{preHandler:[requireAuth]},async request=>({success:true,offer:await fastify.hrService.acceptOffer(context(request),requestParam(request.params,'id')??'')}));
  fastify.post('/hr/training-enrollments/:id/complete',{preHandler:[requireAuth]},async request=>{const b=request.body as {score?:number};return{success:true,enrollment:await fastify.hrService.completeTraining(context(request),requestParam(request.params,'id')??'',typeof b.score==='number'?b.score:undefined)};});
  fastify.post('/hr/employees/:id/final-settlement',{preHandler:[requireAuth]},async request=>{const b=request.body as {exitRecordId?:string};return{success:true,settlement:await fastify.hrService.createExitSettlement(context(request),requestParam(request.params,'id')??'',b.exitRecordId)};});

  fastify.get('/hr/analytics/workforce',{preHandler:[requireAuth]},async request=>({success:true,...await fastify.hrService.workforceSummary(context(request))}));

  fastify.post('/hr/attendance/:id/evaluate',{preHandler:[requireAuth]},async request=>({success:true,attendance:await fastify.hrService.evaluateAttendance(context(request),requestParam(request.params,'id')??'')}));
  fastify.post('/hr/missing-punch/:id/resolve',{preHandler:[requireAuth]},async request=>{const b=request.body as Record<string,unknown>;return{success:true,case:await fastify.hrService.resolveMissingPunch(context(request),requestParam(request.params,'id')??'',String(b.resolutionType) as any,typeof b.reason==='string'?b.reason:undefined)};});
  fastify.post('/hr/attendance/import',{preHandler:[requireAuth]},async request=>{const b=request.body as any;return{success:true,batch:await fastify.hrService.importAttendance(context(request),String(b.source??'IMPORT'),Array.isArray(b.rows)?b.rows:[])}}); 
  fastify.post('/hr/leave/policy-run',{preHandler:[requireAuth]},async request=>{const b=request.body as any;return{success:true,run:await fastify.hrService.runLeavePolicy(context(request),Number(b.year))}});
  fastify.post('/hr/payroll-runs/:id/validate',{preHandler:[requireAuth]},async request=>({success:true,validation:await fastify.hrService.validatePayroll(context(request),requestParam(request.params,'id')??'')}));
  fastify.post('/hr/payroll-runs/:id/statutory-calculate',{preHandler:[requireAuth]},async request=>({success:true,calculations:await fastify.hrService.calculateStatutory(context(request),requestParam(request.params,'id')??'')}));
  fastify.post('/hr/payroll-runs/:id/reverse',{preHandler:[requireAuth]},async request=>{const b=request.body as any;return{success:true,reversal:await fastify.hrService.reversePayroll(context(request),requestParam(request.params,'id')??'',String(b.reason??''))}});
  fastify.get('/hr/leave/calendar',{preHandler:[requireAuth]},async request=>{const q=request.query as any;return{success:true,items:await fastify.hrService.leaveCalendar(context(request),String(q.startDate??''),String(q.endDate??''))}});
  fastify.get('/hr/analytics/:report',{preHandler:[requireAuth]},async request=>{const q=request.query as any;return{success:true,items:await fastify.hrService.analyticsReport(context(request),String((request.params as any).report),typeof q.startDate==='string'?q.startDate:undefined,typeof q.endDate==='string'?q.endDate:undefined)}});
  fastify.post('/hr/attendance/finalize-period',{preHandler:[requireAuth]},async request=>{const b=request.body as any;return{success:true,result:await fastify.hrService.finalizeAttendancePeriod(context(request),String(b.startDate),String(b.endDate))}});

};

export default hrRoutes;
