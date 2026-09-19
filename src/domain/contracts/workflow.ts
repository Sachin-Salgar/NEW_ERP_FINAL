export interface WorkflowContext { tenantId:string; branchId:string; userId:string; }
export type WorkflowDecision='APPROVE'|'REJECT'|'RETURN';
export interface WorkflowStepConfig { step:number; roleId:string; requiredApprovals?:number; }
export interface WorkflowDefinitionInput { code:string; name:string; documentType:string; action:string; branchId?:string|null; steps:WorkflowStepConfig[]; }
export interface WorkflowRepository {
 createDefinition(c:WorkflowContext,input:WorkflowDefinitionInput):Promise<any>;
 listDefinitions(c:WorkflowContext):Promise<any[]>;
 publishDefinition(c:WorkflowContext,id:string):Promise<any>;
 findPublished(c:WorkflowContext,documentType:string,action:string):Promise<any|null>;
 startInstance(c:WorkflowContext,input:{definitionId:string;definitionVersion:number;documentType:string;documentId:string;action:string;documentVersion:number;operationKey:string;steps:WorkflowStepConfig[]}):Promise<any>;
 getInstance(c:WorkflowContext,id:string):Promise<any|null>;
 listTasks(c:WorkflowContext,pendingOnly?:boolean):Promise<any[]>;
 decide(c:WorkflowContext,taskId:string,decision:WorkflowDecision,comments?:string):Promise<any>;
}
export interface WorkflowApprovedHandler { (context:WorkflowContext,instance:any):Promise<void>; }