import type { FastifyPluginAsync,FastifyRequest } from 'fastify';
import { requireAuth,requirePermission } from '../middleware/auth.js';
import { requestParam } from '../request-input.js';
import { ValidationError } from '../../../domain/errors.js';
import { WORKFLOW_PERMISSIONS as P } from '../../../application/services/workflow-service.js';
const ctx=(r:FastifyRequest)=>{if(!r.tenantId||!r.user?.branchId)throw new ValidationError('Authenticated tenant and branch context is required.');return{tenantId:r.tenantId,branchId:r.user.branchId,userId:r.user.id};};
const workflowRoutes:FastifyPluginAsync=async f=>{
 f.get('/workflow/definitions',{preHandler:[requireAuth,requirePermission(P.definitionRead)]},async r=>({success:true,definitions:await f.workflowService.listDefinitions(ctx(r))}));
 f.post('/workflow/definitions',{preHandler:[requireAuth,requirePermission(P.definitionCreate)]},async(r,h)=>{h.code(201);return{success:true,definition:await f.workflowService.createDefinition(ctx(r),r.body as any)};});
 f.post('/workflow/definitions/:id/publish',{preHandler:[requireAuth,requirePermission(P.definitionPublish)]},async r=>({success:true,definition:await f.workflowService.publishDefinition(ctx(r),requestParam(r.params,'id')??'')}));
 f.get('/workflow/tasks',{preHandler:[requireAuth,requirePermission(P.taskRead)]},async r=>({success:true,tasks:await f.workflowService.listTasks(ctx(r))}));
 f.post('/workflow/tasks/:id/decision',{preHandler:[requireAuth,requirePermission(P.taskDecide)]},async r=>({success:true,instance:await f.workflowService.decide(ctx(r),requestParam(r.params,'id')??'',(r.body as any).decision,(r.body as any).comments)}));
 f.get('/workflow/instances/:id',{preHandler:[requireAuth,requirePermission(P.taskRead)]},async r=>({success:true,instance:await f.workflowService.getInstance(ctx(r),requestParam(r.params,'id')??'')}));
};
export default workflowRoutes;