import { afterAll, describe, expect, it } from 'vitest';
import { fixture, closeFixture, headers, login } from './authorization-proof-fixtures.js';

describe('Manufacturing Functional Specification execution proof',()=>{
 let value:Awaited<ReturnType<typeof fixture>>;
 afterAll(async()=>{if(value)await closeFixture(value);});
 it('executes capability -> routing -> work order -> task -> readiness -> production -> quality',async()=>{
  value=await fixture();
  const token=await login(value.app,value.tenantASeed,value.tenantA.tenantId);
  const h=headers(token,value.tenantA.tenantId);
  const itemResponse=await value.app.inject({method:'POST',url:'/api/v1/inventory/items',headers:h,payload:{code:'MFG-CI-ITEM',name:'Manufacturing CI Item',unitOfMeasure:'EA'}});
  expect(itemResponse.statusCode).toBe(201);
  const itemId=itemResponse.json().item.id;
  const machine=(await value.app.inject({method:'POST',url:'/api/v1/manufacturing/machines',headers:h,payload:{code:'MFG-CI-01',name:'CI Machine',productionMachine:true}}));
  expect(machine.statusCode).toBe(201);
  const machineId=machine.json().machine.id;
  const tool=(await value.app.inject({method:'POST',url:'/api/v1/manufacturing/tools',headers:h,payload:{code:'TOOL-CI-01',name:'CI Tool'}}));expect(tool.statusCode).toBe(201);
  const fixture=(await value.app.inject({method:'POST',url:'/api/v1/manufacturing/fixtures',headers:h,payload:{code:'FIX-CI-01',name:'CI Fixture'}}));expect(fixture.statusCode).toBe(201);
  const cap=(await value.app.inject({method:'POST',url:'/api/v1/manufacturing/capabilities',headers:h,payload:{machineId,operationCode:'OP-10',capabilityName:'CI Operation',minValue:1,maxValue:100,toolingId:tool.json().tool.id,fixtureId:fixture.json().fixture.id}}));expect(cap.statusCode).toBe(201);
  const process=(await value.app.inject({method:'POST',url:'/api/v1/manufacturing/process-details',headers:h,payload:{itemId:itemId,revision:'CI-R1',status:'ACTIVE'}}));expect(process.statusCode).toBe(201);
  const processId=process.json().process.id;
  const routing=(await value.app.inject({method:'POST',url:`/api/v1/manufacturing/process-details/${processId}/routing-operations`,headers:h,payload:{sequenceNo:1,operationCode:'OP-10',operationDescription:'CI operation'}}));expect(routing.statusCode).toBe(201);
  const wo=(await value.app.inject({method:'POST',url:'/api/v1/manufacturing/work-orders',headers:h,payload:{workOrderNumber:'CI-WO-001',itemId:item.rows[0].id,processDetailId:processId,plannedQuantity:10}}));expect(wo.statusCode).toBe(201);
  const woId=wo.json().workOrder.id;
  expect((await value.app.inject({method:'POST',url:`/api/v1/manufacturing/work-orders/${woId}/schedule`,headers:h})).statusCode).toBe(200);
  const tasks=await value.adminPool.query<{id:string}>(`SELECT id FROM manufacturing_task_sheets WHERE tenant_id=$1 AND work_order_id=$2`,[value.tenantA.tenantId,woId]);expect(tasks.rows).toHaveLength(1);
  const taskId=tasks.rows[0].id;
  const calibration=await value.app.inject({method:'POST',url:'/api/v1/manufacturing/calibrations',headers:h,payload:{entityType:'MACHINE',entityId:machineId,validFrom:'2026-01-01',validUntil:'2027-12-31',status:'VALID'}});expect(calibration.statusCode).toBe(201);
  const ready=await value.app.inject({method:'POST',url:'/api/v1/manufacturing/readiness/check',headers:h,payload:{taskSheetId:taskId,machineId,capabilityValue:50}});expect(ready.statusCode).toBe(200);expect(ready.json().readiness.passed).toBe(true);
  const output=await value.app.inject({method:'POST',url:'/api/v1/manufacturing/production-output',headers:h,payload:{taskSheetId:taskId,quantity:10,outputType:'GOOD',operationKey:'CI-WO-001-OP-10'}});expect(output.statusCode).toBe(201);
  const quality=await value.app.inject({method:'POST',url:'/api/v1/manufacturing/quality-output',headers:h,payload:{taskSheetId,inspectedQuantity:10,acceptedQuantity:9,rejectedQuantity:1,reworkQuantity:0,returnedQuantity:0}});expect(quality.statusCode).toBe(201);
  const badQuality=await value.app.inject({method:'POST',url:'/api/v1/manufacturing/quality-output',headers:h,payload:{taskSheetId,inspectedQuantity:1,acceptedQuantity:1,rejectedQuantity:1,reworkQuantity:0,returnedQuantity:0}});expect(badQuality.statusCode).toBe(400);
 });
});
