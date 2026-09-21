import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { parsePaginationQuery } from '../pagination.js';
import { requestParam } from '../request-input.js';
import { ValidationError } from '../../../domain/errors.js';
const ctx=(r:FastifyRequest)=>{if(!r.user?.tenantId||!r.tenantId)throw new ValidationError('Authenticated tenant context is required.');return{tenantId:r.tenantId,userId:r.user.id,branchId:r.user.branchId??null};};
const route:FastifyPluginAsync=async fastify=>{
 fastify.get('/hr/:resource',{preHandler:[requireAuth]},async request=>{const q=request.query as any;const p=parsePaginationQuery(request.query);return{success:true,...await fastify.hrService.list(ctx(request),requestParam(request.params,'resource')??'',p.page,p.pageSize,q.search)};});
 fastify.get('/hr/:resource/:id',{preHandler:[requireAuth]},async request=>({success:true,record:await fastify.hrService.get(ctx(request),requestParam(request.params,'resource')??'',requestParam(request.params,'id')??'')}));
 fastify.post('/hr/:resource',{preHandler:[requireAuth]},async request=>({success:true,record:await fastify.hrService.create(ctx(request),requestParam(request.params,'resource')??'',request.body as Record<string,unknown>)}));
 fastify.patch('/hr/:resource/:id',{preHandler:[requireAuth]},async request=>({success:true,record:await fastify.hrService.update(ctx(request),requestParam(request.params,'resource')??'',requestParam(request.params,'id')??'',request.body as Record<string,unknown>)}));
 fastify.delete('/hr/:resource/:id',{preHandler:[requireAuth]},async request=>({success:true,record:await fastify.hrService.remove(ctx(request),requestParam(request.params,'resource')??'',requestParam(request.params,'id')??'')}));
 fastify.post('/hr/employees/:id/grant-access',{preHandler:[requireAuth,requirePermission('hr.employee.grant_access'),requirePermission('user.create')]},async request=>{const body=request.body as any;const registration=await fastify.registrationService.registerUser(request.tenantId!,request.user!.id,{username:String(body.username),email:String(body.email),password:String(body.password),defaultBranchId:body.defaultBranchId??request.user!.branchId??null,roleCode:body.roleCode??'member'});const employee=await fastify.hrService.linkUser(ctx(request),requestParam(request.params,'id')??'',registration.id);return{success:true,user:registration,employee};});
 fastify.post('/hr/attendance/:employeeId/check-in',{preHandler:[requireAuth]},async request=>({success:true,attendance:await fastify.hrService.punch(ctx(request),requestParam(request.params,'employeeId')??'','IN',(request.body as any)?.at)}));
 fastify.post('/hr/attendance/:employeeId/check-out',{preHandler:[requireAuth]},async request=>({success:true,attendance:await fastify.hrService.punch(ctx(request),requestParam(request.params,'employeeId')??'','OUT',(request.body as any)?.at)}));
 fastify.post('/hr/payroll-runs/:id/calculate',{preHandler:[requireAuth]},async request=>({success:true,payrollRun:await fastify.hrService.calculatePayroll(ctx(request),requestParam(request.params,'id')??'')}));
};
export default route;
