export interface ManufacturingExecutionContext { tenantId:string; branchId:string; financialYearId:string; userId:string; }
export interface ManufacturingExecutionRepository {
 createCapability(input:any):Promise<any>; listCapabilities(context:any,query:any):Promise<any>;
 createProcess(input:any):Promise<any>; addRoutingOperation(input:any):Promise<any>; getProcess(context:any,id:string):Promise<any>;
 createWorkOrder(input:any):Promise<any>; scheduleWorkOrder(input:any):Promise<any>; listWorkOrders(context:any,query:any):Promise<any>;
 getTaskSheet(context:any,id:string):Promise<any>; updateTaskStatus(input:any):Promise<any>;
 createMaterialRequisition(input:any):Promise<any>; issueMaterial(input:any):Promise<any>;
 readinessGate(input:any):Promise<any>; punchProduction(input:any):Promise<any>;
 punchQuality(input:any):Promise<any>; createMaterialReturn(input:any):Promise<any>;
 createVariance(input:any):Promise<any>;
}