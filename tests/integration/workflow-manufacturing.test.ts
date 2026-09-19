import { afterAll, describe, expect, it } from 'vitest';
import { closeFixture, fixture, headers, login } from './authorization-proof-fixtures.js';

describe('Configurable workflow integration',()=>{
 let value:Awaited<ReturnType<typeof fixture>>;
 afterAll(async()=>{if(value)await closeFixture(value);});
 it('blocks a configured manufacturing scheduling operation pending approval',async()=>{
  value=await fixture();
  const token=await login(value.app,value.tenantASeed,value.tenantA.tenantId);
  const h=headers(token,value.tenantA.tenantId);
  const role=(await value.adminPool.query('SELECT id FROM roles WHERE tenant_id=$1 AND is_deleted=false ORDER BY created_at LIMIT 1',[value.tenantA.tenantId])).rows[0];
  const item=(await value.app.inject({method:'POST',url:'/api/v1/inventory/items',headers:h,payload:{code:'WF-CI-ITEM',name:'Workflow Item',unitOfMeasure:'EA'}})).json().item;
  const process=(await value.app.inject({method:'POST',url:'/api/v1/manufacturing/process-details',headers:h,payload:{itemId:item.id,revision:'WF-R1',status:'ACTIVE'}})).json().process;
  await value.app.inject({method:'POST',url:`/api/v1/manufacturing/process-details/${process.id}/routing-operations`,headers:h,payload:{sequenceNo:1,operationCode:'OP-10',operationDescription:'Workflow operation'}});
  const def=await value.app.inject({method:'POST',url:'/api/v1/workflow/definitions',headers:h,payload:{code:'MFG-WO-SCHEDULE',name:'Manufacturing Work Order Scheduling',documentType:'manufacturing_work_order',action:'SCHEDULE',steps:[{step:1,roleId:role.id,requiredApprovals:1}]}});
  expect(def.statusCode).toBe(201);
  expect((await value.app.inject({method:'POST',url:`/api/v1/workflow/definitions/${def.json().definition.id}/publish`,headers:h})).statusCode).toBe(200);
  const wo=await value.app.inject({method:'POST',url:'/api/v1/manufacturing/work-orders',headers:h,payload:{workOrderNumber:'WF-CI-WO-001',itemId:item.id,processDetailId:process.id,plannedQuantity:5}});
  expect(wo.statusCode).toBe(201);
  const scheduled=await value.app.inject({method:'POST',url:`/api/v1/manufacturing/work-orders/${wo.json().workOrder.id}/schedule`,headers:h});
  expect(scheduled.statusCode).toBe(200);
  expect(scheduled.json().pendingApproval).toBe(true);
  expect((await value.app.inject({method:'GET',url:'/api/v1/workflow/tasks',headers:h})).json().tasks).toHaveLength(1);
 });
});