import type { Pool } from 'pg';
import type { WorkflowRepository, WorkflowContext, WorkflowDefinitionInput, WorkflowDecision } from '../../../domain/contracts/workflow.js';
import { withTenantContext } from '../tenant-context.js';
import { ConflictError, NotFoundError, ValidationError } from '../../../domain/errors.js';

export class PostgresWorkflowRepository implements WorkflowRepository {
 constructor(private readonly pool:Pool,private readonly tenantContextKey='app.current_tenant_id'){}
 private tx<T>(c:WorkflowContext,fn:(db:any)=>Promise<T>){return withTenantContext(this.pool,this.tenantContextKey,c.tenantId,fn,{userId:c.userId});}
 async createDefinition(c:WorkflowContext,i:WorkflowDefinitionInput){
  return this.tx(c,async db=>{const exists=await db.query('SELECT 1 FROM workflow_definitions WHERE tenant_id=$1 AND code=$2 ORDER BY version DESC LIMIT 1',[c.tenantId,i.code]);
   const version=exists.rowCount?1+(await db.query('SELECT COALESCE(max(version),0)::int v FROM workflow_definitions WHERE tenant_id=$1 AND code=$2',[c.tenantId,i.code])).rows[0].v:1;
   const r=await db.query(`INSERT INTO workflow_definitions(tenant_id,branch_id,code,name,document_type,action,version,steps,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$9) RETURNING *`,[c.tenantId,i.branchId??null,i.code,i.name,i.documentType,i.action,version,JSON.stringify(i.steps),c.userId]);return r.rows[0];});
 }
 async listDefinitions(c:WorkflowContext){return this.tx(c,async db=>(await db.query('SELECT * FROM workflow_definitions WHERE tenant_id=$1 ORDER BY code,version DESC',[c.tenantId])).rows);}
 async publishDefinition(c:WorkflowContext,id:string){
  return this.tx(c,async db=>{const d=(await db.query('SELECT * FROM workflow_definitions WHERE id=$1 AND tenant_id=$2 FOR UPDATE',[id,c.tenantId])).rows[0];if(!d)throw new NotFoundError('Workflow definition not found.');
   if(!Array.isArray(d.steps)||!d.steps.length)throw new ValidationError('A workflow definition requires at least one approval step.');
   for(const s of d.steps){if(!Number.isInteger(Number(s.step))||Number(s.step)<1||typeof s.roleId!=='string')throw new ValidationError('Workflow steps require positive step numbers and role IDs.');if(Number(s.requiredApprovals??1)<1)throw new ValidationError('Required approvals must be positive.');}
   const conflict = d.branch_id===null
    ? await db.query(`SELECT id FROM workflow_definitions WHERE tenant_id=$1 AND branch_id IS NULL AND document_type=$2 AND action=$3 AND status=\'PUBLISHED\' AND id<>$4`,[c.tenantId,d.document_type,d.action,id])
    : await db.query(`SELECT id FROM workflow_definitions WHERE tenant_id=$1 AND branch_id=$2 AND document_type=$3 AND action=$4 AND status=\'PUBLISHED\' AND id<>$5`,[c.tenantId,d.branch_id,d.document_type,d.action,id]);
   if(conflict.rowCount)throw new ConflictError('A published workflow already exists for this operation and scope.');
   if(d.branch_id===null)
    await db.query('UPDATE workflow_definitions SET status=\\'RETIRED\\`,updated_at=now(),updated_by=$2 WHERE tenant_id=$1 AND branch_id IS NULL AND document_type=$3 AND action=$4 AND status=\'PUBLISHED\' AND id<>$5`,[c.tenantId,c.userId,d.document_type,d.action,id]);
   else
    await db.query('UPDATE workflow_definitions SET status=\\'RETIRED\\`,updated_at=now(),updated_by=$2 WHERE tenant_id=$1 AND branch_id=$3 AND document_type=$4 AND action=$5 AND status=\'PUBLISHED\' AND id<>$6`,[c.tenantId,c.userId,d.branch_id,d.document_type,d.action,id]);
   return (await db.query('UPDATE workflow_definitions SET status=\'PUBLISHED\',updated_at=now(),updated_by=$2 WHERE id=$1 AND tenant_id=$3 RETURNING *',[id,c.userId,c.tenantId])).rows[0];});
 }
 async findPublished(c:WorkflowContext,documentType:string,action:string){
  return this.tx(c,async db=>(await db.query(`SELECT * FROM workflow_definitions WHERE tenant_id=$1 AND document_type=$2 AND action=$3 AND status='PUBLISHED' AND (branch_id=$4 OR branch_id IS NULL) ORDER BY branch_id NULLS LAST,version DESC LIMIT 1`,[c.tenantId,documentType,action,c.branchId])).rows[0]??null);
 }
 async startInstance(c:WorkflowContext,i:any){
  return this.tx(c,async db=>{const existing=(await db.query('SELECT * FROM workflow_instances WHERE tenant_id=$1 AND operation_key=$2',[c.tenantId,i.operationKey])).rows[0];if(existing)return existing;
   const r=(await db.query(`INSERT INTO workflow_instances(tenant_id,branch_id,definition_id,definition_version,document_type,document_id,action,document_version,initiator_user_id,operation_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,[c.tenantId,c.branchId,i.definitionId,i.definitionVersion,i.documentType,i.documentId,i.action,i.documentVersion,c.userId,i.operationKey])).rows[0];
   const first=i.steps.slice().sort((a:any,b:any)=>a.step-b.step)[0];await db.query('INSERT INTO workflow_tasks(tenant_id,branch_id,workflow_instance_id,step_no,assignee_role_id,required_approvals) VALUES($1,$2,$3,$4,$5,$6)',[c.tenantId,c.branchId,r.id,first.step,first.roleId,Number(first.requiredApprovals??1)]);return r;});
 }
 async getInstance(c:WorkflowContext,id:string){return this.tx(c,async db=>(await db.query('SELECT * FROM workflow_instances WHERE tenant_id=$1 AND branch_id=$2 AND id=$3',[c.tenantId,c.branchId,id])).rows[0]??null);}
 async listTasks(c:WorkflowContext,pendingOnly=true){return this.tx(c,async db=>(await db.query(`SELECT wt.*,wi.document_type,wi.document_id,wi.action,wi.initiator_user_id,r.name role_name FROM workflow_tasks wt JOIN workflow_instances wi ON wi.id=wt.workflow_instance_id AND wi.tenant_id=wt.tenant_id JOIN roles r ON r.id=wt.assignee_role_id AND r.tenant_id=wt.tenant_id WHERE wt.tenant_id=$1 AND wt.branch_id=$2 AND ($3=false OR wt.status='PENDING') ORDER BY wt.created_at`,[c.tenantId,c.branchId,pendingOnly])).rows);}
 async decide(c:WorkflowContext,taskId:string,decision:WorkflowDecision,comments?:string){
  return this.tx(c,async db=>{const task=(await db.query('SELECT wt.*,wi.document_type,wi.document_id,wi.action,wi.initiator_user_id,wi.current_step,wi.status instance_status,wi.operation_key FROM workflow_tasks wt JOIN workflow_instances wi ON wi.id=wt.workflow_instance_id AND wi.tenant_id=wt.tenant_id WHERE wt.id=$1 AND wt.tenant_id=$2 AND wt.branch_id=$3 FOR UPDATE',[taskId,c.tenantId,c.branchId])).rows[0];
   if(!task)throw new NotFoundError('Workflow task not found.');if(task.status!=='PENDING'||task.instance_status!=='PENDING')throw new ConflictError('Workflow task is no longer actionable.');if(task.initiator_user_id===c.userId)throw new ConflictError('Segregation of duties prevents the requester from approving their own transaction.');
   const member=await db.query('SELECT 1 FROM user_roles WHERE tenant_id=$1 AND user_id=$2 AND role_id=$3',[c.tenantId,c.userId,task.assignee_role_id]);if(!member.rowCount)throw new ValidationError('User is not assigned to the workflow approval role.');
   const prior=await db.query('SELECT 1 FROM workflow_decisions WHERE tenant_id=$1 AND workflow_task_id=$2 AND actor_user_id=$3',[c.tenantId,taskId,c.userId]);if(prior.rowCount)throw new ConflictError('This user has already decided this approval task.');
   await db.query('INSERT INTO workflow_decisions(tenant_id,branch_id,workflow_task_id,actor_user_id,decision,comments) VALUES($1,$2,$3,$4,$5,$6)',[c.tenantId,c.branchId,taskId,c.userId,decision,comments??null]);
   if(decision!=='APPROVE'){await db.query('UPDATE workflow_tasks SET status=$1,completed_at=now() WHERE id=$2 AND tenant_id=$3',[decision==='REJECT'?'REJECTED':'RETURNED',taskId,c.tenantId]);return (await db.query('UPDATE workflow_instances SET status=$1,completed_at=now() WHERE id=$2 AND tenant_id=$3 RETURNING *',[decision==='REJECT'?'REJECTED':'RETURNED',task.workflow_instance_id,c.tenantId])).rows[0];}
   const count=Number((await db.query('SELECT count(*)::int c FROM workflow_decisions WHERE tenant_id=$1 AND workflow_task_id=$2 AND decision=\'APPROVE\'',[c.tenantId,taskId])).rows[0].c);
   if(count<Number(task.required_approvals)){await db.query('UPDATE workflow_tasks SET approval_count=$1 WHERE id=$2 AND tenant_id=$3',[count,taskId,c.tenantId]);return (await db.query('SELECT * FROM workflow_instances WHERE id=$1 AND tenant_id=$2',[task.workflow_instance_id,c.tenantId])).rows[0];}
   await db.query('UPDATE workflow_tasks SET approval_count=$1,status=\'APPROVED\',completed_at=now() WHERE id=$2 AND tenant_id=$3',[count,taskId,c.tenantId]);
   const def=(await db.query('SELECT steps FROM workflow_definitions d JOIN workflow_instances wi ON wi.definition_id=d.id AND wi.definition_version=d.version WHERE wi.id=$1 AND d.tenant_id=$2',[task.workflow_instance_id,c.tenantId])).rows[0];
   const steps=(def?.steps??[]).sort((a:any,b:any)=>Number(a.step)-Number(b.step));const idx=steps.findIndex((s:any)=>Number(s.step)===Number(task.step_no));const next=steps[idx+1];
   if(!next)return (await db.query('UPDATE workflow_instances SET status=\'APPROVED\',completed_at=now() WHERE id=$1 AND tenant_id=$2 RETURNING *',[task.workflow_instance_id,c.tenantId])).rows[0];
   await db.query('UPDATE workflow_instances SET current_step=$1 WHERE id=$2 AND tenant_id=$3',[next.step,task.workflow_instance_id,c.tenantId]);
   await db.query('INSERT INTO workflow_tasks(tenant_id,branch_id,workflow_instance_id,step_no,assignee_role_id,required_approvals) VALUES($1,$2,$3,$4,$5,$6)',[c.tenantId,c.branchId,task.workflow_instance_id,next.step,next.roleId,Number(next.requiredApprovals??1)]);
   return (await db.query('SELECT * FROM workflow_instances WHERE id=$1 AND tenant_id=$2',[task.workflow_instance_id,c.tenantId])).rows[0];
  });
 }
}