/** Canonical tenant-scoped HR service: employee, time, leave, payroll, talent and compliance operations. */
import { validate as isUuid, v7 as uuidV7 } from 'uuid';
import type { Pool } from 'pg';
import { ForbiddenError, NotFoundError, ValidationError } from '../../domain/errors.js';
import type { AuthorizationService } from './authorization-service.js';
import type { ModuleAccessService } from './module-access-service.js';
import type { WorkflowService } from './workflow-service.js';
import { withTenantContext } from '../../infrastructure/database/tenant-context.js';

export interface HrContext { tenantId: string; branchId?: string | null; userId: string; }
export const HR_PERMISSION_INVENTORY = [
  'hr.employee','hr.department','hr.position','hr.business_unit','hr.division','hr.section','hr.team','hr.shift','hr.employee_shift','hr.holiday','hr.attendance','hr.punch','hr.attendance_correction','hr.leave_type','hr.leave_policy','hr.leave_balance','hr.leave_transaction','hr.leave_request','hr.salary_component','hr.salary_structure','hr.employee_salary','hr.payroll_period','hr.payroll_run','hr.payslip','hr.payroll_adjustment','hr.payroll_loan','hr.payroll_reimbursement','hr.statutory_rule','hr.recruitment_requisition','hr.candidate','hr.application','hr.interview','hr.performance_cycle','hr.performance_review','hr.training_program','hr.training_record','hr.compliance','hr.employee_request','hr.employee_skill','hr.employee_document','hr.employee_relation','hr.exit_record','hr.onboarding','hr.analytics','hr.employment_history','hr.shift_calendar','hr.attendance_rule','hr.attendance_regularization','hr.overtime_record','hr.leave_accrual_run','hr.leave_encashment','hr.leave_cancellation','hr.job_opening','hr.candidate_screening','hr.interview_evaluation','hr.job_offer','hr.performance_goal','hr.performance_feedback','hr.competency','hr.rating_scale','hr.development_plan','hr.promotion_record','hr.training_catalog','hr.training_batch','hr.training_enrollment','hr.training_assessment','hr.training_certificate','hr.policy_acknowledgement','hr.grievance','hr.warning','hr.disciplinary_action','hr.investigation','hr.employee_agreement','hr.compliance_task','hr.exit_interview','hr.payroll_statutory_declaration','hr.payroll_settlement','hr.finance_posting','hr.payroll.calculate','hr.payroll.approve','hr.payroll.close','hr.employee.grant_access','hr.legal_entity','hr.grade','hr.headcount_plan','hr.wfh_request','hr.business_travel_request','hr.missing_punch_case','hr.attendance_import_batch','hr.attendance_import_row','hr.statutory_calculation','hr.payroll_reversal','hr.payroll_validation_result','hr.attendance_state_history','hr.leave_policy_run','hr.access_history',
] as const;
const TABLES: Record<string,string> = {
 employees:'hr_employees',departments:'hr_departments',positions:'hr_positions',businessUnits:'hr_business_units',divisions:'hr_divisions',sections:'hr_sections',teams:'hr_teams',
 shifts:'hr_shifts',employeeShifts:'hr_employee_shifts',holidays:'hr_holidays',attendance:'hr_attendance',punches:'hr_attendance_punches',attendanceCorrections:'hr_attendance_corrections',
 leaveTypes:'hr_leave_types',leavePolicies:'hr_leave_policies',leaveBalances:'hr_leave_balances',leaveTransactions:'hr_leave_transactions',leaveRequests:'hr_leave_requests',
 salaryComponents:'hr_salary_components',salaryStructures:'hr_salary_structures',employeeSalary:'hr_employee_salary',payrollPeriods:'hr_payroll_periods',payrollRuns:'hr_payroll_runs',payslips:'hr_payslips',payrollAdjustments:'hr_payroll_adjustments',payrollLoans:'hr_payroll_loans',payrollReimbursements:'hr_payroll_reimbursements',statutoryRules:'hr_statutory_rules',
 requisitions:'hr_recruitment_requisitions',candidates:'hr_candidates',applications:'hr_applications',interviews:'hr_interviews',performanceCycles:'hr_performance_cycles',performanceReviews:'hr_performance_reviews',trainingPrograms:'hr_training_programs',trainingRecords:'hr_training_records',compliance:'hr_compliance_records',employeeRequests:'hr_employee_requests',employeeSkills:'hr_employee_skills',employeeDocuments:'hr_employee_documents',employeeRelations:'hr_employee_relations',exitRecords:'hr_exit_records',onboarding:'hr_onboarding_records',employmentHistory:'hr_employment_history',shiftCalendars:'hr_shift_calendars',attendanceRules:'hr_attendance_rules',attendanceRegularizations:'hr_attendance_regularizations',overtimeRecords:'hr_overtime_records',leaveAccrualRuns:'hr_leave_accrual_runs',leaveEncashments:'hr_leave_encashments',leaveCancellations:'hr_leave_cancellations',jobOpenings:'hr_job_openings',candidateScreenings:'hr_candidate_screenings',interviewEvaluations:'hr_interview_evaluations',jobOffers:'hr_job_offers',performanceGoals:'hr_performance_goals',performanceFeedback:'hr_performance_feedback',competencies:'hr_competencies',ratingScales:'hr_rating_scales',developmentPlans:'hr_development_plans',promotionRecords:'hr_promotion_records',trainingCatalog:'hr_training_catalog',trainingBatches:'hr_training_batches',trainingEnrollments:'hr_training_enrollments',trainingAssessments:'hr_training_assessments',trainingCertificates:'hr_training_certificates',policyAcknowledgements:'hr_policy_acknowledgements',grievances:'hr_grievances',warnings:'hr_warnings',disciplinaryActions:'hr_disciplinary_actions',investigations:'hr_investigations',employeeAgreements:'hr_employee_agreements',complianceTasks:'hr_compliance_tasks',exitInterviews:'hr_exit_interviews',payrollStatutoryDeclarations:'hr_payroll_statutory_declarations',payrollSettlements:'hr_payroll_settlements',financePostings:'hr_finance_postings'
};
const RESOURCE: Record<string,string> = {}; Object.keys(TABLES).forEach(k=>RESOURCE[k]=k); Object.assign(RESOURCE,{employees:'employee',departments:'department',positions:'position',businessUnits:'business_unit',divisions:'division',sections:'section',teams:'team',shifts:'shift',employeeShifts:'employee_shift',holidays:'holiday',attendance:'attendance',punches:'punch',attendanceCorrections:'attendance_correction',leaveTypes:'leave_type',leavePolicies:'leave_policy',leaveBalances:'leave_balance',leaveTransactions:'leave_transaction',leaveRequests:'leave_request',salaryComponents:'salary_component',salaryStructures:'salary_structure',employeeSalary:'employee_salary',payrollPeriods:'payroll_period',payrollRuns:'payroll_run',payslips:'payslip',payrollAdjustments:'payroll_adjustment',payrollLoans:'payroll_loan',payrollReimbursements:'payroll_reimbursement',statutoryRules:'statutory_rule',requisitions:'recruitment_requisition',candidates:'candidate',applications:'application',interviews:'interview',performanceCycles:'performance_cycle',performanceReviews:'performance_review',trainingPrograms:'training_program',trainingRecords:'training_record',compliance:'compliance',employeeRequests:'employee_request',employeeSkills:'employee_skill',employeeDocuments:'employee_document',employeeRelations:'employee_relation',exitRecords:'exit_record',onboarding:'onboarding',employmentHistory:'employment_history',shiftCalendars:'shift_calendar',attendanceRules:'attendance_rule',attendanceRegularizations:'attendance_regularization',overtimeRecords:'overtime_record',leaveAccrualRuns:'leave_accrual_run',leaveEncashments:'leave_encashment',leaveCancellations:'leave_cancellation',jobOpenings:'job_opening',candidateScreenings:'candidate_screening',interviewEvaluations:'interview_evaluation',jobOffers:'job_offer',performanceGoals:'performance_goal',performanceFeedback:'performance_feedback',competencies:'competency',ratingScales:'rating_scale',developmentPlans:'development_plan',promotionRecords:'promotion_record',trainingCatalog:'training_catalog',trainingBatches:'training_batch',trainingEnrollments:'training_enrollment',trainingAssessments:'training_assessment',trainingCertificates:'training_certificate',policyAcknowledgements:'policy_acknowledgement',grievances:'grievance',warnings:'warning',disciplinaryActions:'disciplinary_action',investigations:'investigation',employeeAgreements:'employee_agreement',complianceTasks:'compliance_task',exitInterviews:'exit_interview',payrollStatutoryDeclarations:'payroll_statutory_declaration',payrollSettlements:'payroll_settlement',financePostings:'finance_posting'});
const WORKFLOW_TYPE: Record<string,string>={leaveRequests:'HR_LEAVE_REQUEST',requisitions:'HR_RECRUITMENT_REQUISITION',payrollRuns:'HR_PAYROLL_RUN',attendanceCorrections:'HR_ATTENDANCE_CORRECTION',employeeRequests:'HR_EMPLOYEE_REQUEST',payrollReimbursements:'HR_PAYROLL_REIMBURSEMENT',payrollLoans:'HR_PAYROLL_LOAN'};

export class HrService {
 constructor(private pool:Pool,private tenantKey:string,private authorization:Pick<AuthorizationService,'hasPermission'>,private modules:Pick<ModuleAccessService,'isModuleEnabled'>,private workflow?:Pick<WorkflowService,'onDocumentSubmitted'>){}
 private async auth(c:HrContext,r:string,a:string){if(!isUuid(c.tenantId)||!isUuid(c.userId))throw new ValidationError('Valid tenant and user context is required.');if(!(await this.modules.isModuleEnabled(c.tenantId,'hr')))throw new ForbiddenError('HR module is not enabled.');if(!(await this.authorization.hasPermission(c.tenantId,c.userId,'hr.'+r+'.'+a)))throw new ForbiddenError('HR permission denied.');}
 private table(kind:string){const table=TABLES[kind],resource=RESOURCE[kind];if(!table||!resource)throw new ValidationError('Unknown HR resource.');return{table,resource};}
 async list(c:HrContext,kind:string,page=1,pageSize=20,search?:string){
  const {table,resource}=this.table(kind); await this.auth(c,resource,'read');
  if(page<1||pageSize<1||pageSize>100)throw new ValidationError('Invalid pagination.');
  return withTenantContext(this.pool,this.tenantKey,c.tenantId,async client=>{
   const params:any[]=[c.tenantId]; let where='tenant_id=$1';
   if(search){params.push('%'+search.trim()+'%');const sf=kind==='employees'?'COALESCE(employee_no,first_name,last_name,work_email,\'\')':['departments','positions','businessUnits','divisions','sections','teams','shifts','leaveTypes','leavePolicies','salaryComponents','salaryStructures','payrollPeriods','requisitions','candidates','performanceCycles','trainingPrograms','statutoryRules'].includes(kind)?'COALESCE(code,name,\'\')':'COALESCE(status,\'\')';where+=' AND '+sf+' ILIKE $2';}
   if(['employees','departments','positions','shifts'].includes(kind))where+=' AND COALESCE(is_deleted,false)=false';
   const count=(await client.query('SELECT count(*)::int AS total FROM public.'+table+' WHERE '+where,params)).rows[0].total;
   const limitIndex=params.length+1, offsetIndex=params.length+2;
   params.push(pageSize,(page-1)*pageSize);
   const sql='SELECT * FROM public.'+table+' WHERE '+where+' ORDER BY id DESC LIMIT $'+limitIndex+'::int OFFSET $'+offsetIndex+'::int';
   const rows=(await client.query(sql,params)).rows;
   return{items:rows,total:Number(count)};
  });
 }
 async get(c:HrContext,kind:string,id:string){const {table,resource}=this.table(kind);if(!isUuid(id))throw new ValidationError('Invalid HR id.');await this.auth(c,resource,'read');return withTenantContext(this.pool,this.tenantKey,c.tenantId,async client=>{const q=await client.query('SELECT * FROM public.'+table+' WHERE id=$1 AND tenant_id=$2',[id,c.tenantId]);if(!q.rowCount)throw new NotFoundError('HR record not found.');return q.rows[0];});}
 async create(c:HrContext,kind:string,input:Record<string,unknown>){const {table,resource}=this.table(kind);await this.auth(c,resource,'create');const fields=Object.keys(input).filter(k=>/^[a-z_][a-z0-9_]*$/.test(k)&&!['id','tenant_id'].includes(k));if(!fields.length)throw new ValidationError('No fields supplied.');const vals=[uuidV7(),c.tenantId,...fields.map(k=>input[k])];const record=await withTenantContext(this.pool,this.tenantKey,c.tenantId,async client=>(await client.query('INSERT INTO public.'+table+' (id,tenant_id,'+fields.join(',')+') VALUES ('+vals.map((_,i)=>'$'+(i+1)).join(',')+') RETURNING *',vals)).rows[0]);return record;}
 async update(c:HrContext,kind:string,id:string,input:Record<string,unknown>){const {table,resource}=this.table(kind);if(!isUuid(id))throw new ValidationError('Invalid HR id.');await this.auth(c,resource,'update');const fields=Object.keys(input).filter(k=>/^[a-z_][a-z0-9_]*$/.test(k)&&!['id','tenant_id','created_at'].includes(k));if(!fields.length)throw new ValidationError('No fields supplied.');const vals=[...fields.map(k=>input[k]),id,c.tenantId];const sets=fields.map((k,i)=>k+'=$'+(i+1)).join(',');return withTenantContext(this.pool,this.tenantKey,c.tenantId,async client=>{const q=await client.query('UPDATE public.'+table+' SET '+sets+(['departments','positions','shifts','employees'].includes(kind)?',updated_at=NOW()':'' )+' WHERE id=$'+(vals.length-1)+' AND tenant_id=$'+vals.length+' RETURNING *',vals);if(!q.rowCount)throw new NotFoundError('HR record not found.');return q.rows[0];});}
 async remove(c:HrContext,kind:string,id:string){const {table,resource}=this.table(kind);if(!isUuid(id))throw new ValidationError('Invalid HR id.');await this.auth(c,resource,'delete');if(!['employees','departments','positions','shifts'].includes(kind))throw new ValidationError('This HR resource does not support deletion; use lifecycle/status fields.');return withTenantContext(this.pool,this.tenantKey,c.tenantId,async client=>{const sql=kind==='employees'?'UPDATE public.'+table+' SET is_deleted=true,deleted_at=NOW(),updated_at=NOW() WHERE id=$1 AND tenant_id=$2 RETURNING id':'UPDATE public.'+table+' SET status=\'INACTIVE\',updated_at=NOW() WHERE id=$1 AND tenant_id=$2 RETURNING id';const q=await client.query(sql,[id,c.tenantId]);if(!q.rowCount)throw new NotFoundError('HR record not found.');return q.rows[0];});}
 async punch(c:HrContext,employeeId:string,direction:'IN'|'OUT',punchedAt?:string){await this.auth(c,'attendance',direction==='IN'?'create':'update');if(!isUuid(employeeId))throw new ValidationError('Invalid employee id.');return withTenantContext(this.pool,this.tenantKey,c.tenantId,async client=>{const at=punchedAt?new Date(punchedAt):new Date();if(Number.isNaN(at.getTime()))throw new ValidationError('Invalid timestamp.');await client.query('INSERT INTO hr_attendance_punches(id,tenant_id,employee_id,punched_at,direction,source) VALUES($1,$2,$3,$4,$5,\'MANUAL\')',[uuidV7(),c.tenantId,employeeId,at,direction]);const date=at.toISOString().slice(0,10),field=direction==='IN'?'check_in':'check_out';return(await client.query('INSERT INTO hr_attendance(id,tenant_id,employee_id,attendance_date,'+field+',status,source) VALUES($1,$2,$3,$4,$5,\'PRESENT\',\'MANUAL\') ON CONFLICT(tenant_id,employee_id,attendance_date) DO UPDATE SET '+field+'=EXCLUDED.'+field+',updated_at=NOW() RETURNING *',[uuidV7(),c.tenantId,employeeId,date,at])).rows[0];});}
 async submitForApproval(c:HrContext,kind:string,id:string,expectedVersion=1){const {table,resource}=this.table(kind);await this.auth(c,resource,'update');const workflowType=WORKFLOW_TYPE[kind];if(!workflowType)throw new ValidationError('This HR resource has no workflow configured.');if(!this.workflow)throw new ValidationError('Workflow service is not configured.');if(!isUuid(id))throw new ValidationError('Invalid HR id.');const record=await this.get(c,kind,id);const result=await this.workflow.onDocumentSubmitted(c as any,workflowType,id,expectedVersion,uuidV7());if(result.status!=='APPROVED')await withTenantContext(this.pool,this.tenantKey,c.tenantId,client=>client.query('UPDATE public.'+table+' SET status=$1 WHERE id=$2 AND tenant_id=$3',['SUBMITTED',id,c.tenantId]));return{record,result};}
 async applyWorkflowDecision(c:HrContext,documentType:string,documentId:string,status:'APPROVED'|'REJECTED'|'CORRECTION'){
  if(!isUuid(documentId))throw new ValidationError('Invalid HR document id.');
  const mapping:Record<string,string>={HR_LEAVE_REQUEST:'leaveRequests',HR_RECRUITMENT_REQUISITION:'requisitions',HR_PAYROLL_RUN:'payrollRuns',HR_ATTENDANCE_CORRECTION:'attendanceCorrections',HR_EMPLOYEE_REQUEST:'employeeRequests',HR_PAYROLL_REIMBURSEMENT:'payrollReimbursements',HR_PAYROLL_LOAN:'payrollLoans'};
  const kind=mapping[documentType]; if(!kind)throw new ValidationError('Unsupported HR workflow document.');
  const table=TABLES[kind]; const finalStatus=status==='APPROVED'?'APPROVED':status==='REJECTED'?'REJECTED':'CORRECTION';
  const updated=await withTenantContext(this.pool,this.tenantKey,c.tenantId,async client=>{const sql=documentType==='HR_LEAVE_REQUEST'?'UPDATE public.'+table+' SET status=$1,approved_by=$2,approved_at=NOW() WHERE id=$3 AND tenant_id=$4 RETURNING *':'UPDATE public.'+table+' SET status=$1 WHERE id=$2 AND tenant_id=$3 RETURNING *';const params=documentType==='HR_LEAVE_REQUEST'?[finalStatus,c.userId,documentId,c.tenantId]:[finalStatus,documentId,c.tenantId];const q=await client.query(sql,params);if(!q.rowCount)throw new NotFoundError('HR workflow record not found.');return q.rows[0];});
  if(documentType==='HR_LEAVE_REQUEST'&&finalStatus==='APPROVED')await this.consumeLeave(c,documentId);
  return updated;
 }
 private async consumeLeave(c:HrContext,id:string){await withTenantContext(this.pool,this.tenantKey,c.tenantId,async client=>{const req=(await client.query('SELECT employee_id,leave_type_id,days,EXTRACT(YEAR FROM start_date)::int year FROM hr_leave_requests WHERE id=$1 AND tenant_id=$2 FOR UPDATE',[id,c.tenantId])).rows[0];if(!req)throw new NotFoundError('Leave request not found.');const balance=(await client.query('SELECT * FROM hr_leave_balances WHERE tenant_id=$1 AND employee_id=$2 AND leave_type_id=$3 AND year=$4 FOR UPDATE',[c.tenantId,req.employee_id,req.leave_type_id,req.year])).rows[0];if(!balance)throw new ValidationError('Leave balance is not initialized.');const available=Number(balance.opening)+Number(balance.accrued)+Number(balance.adjusted)-Number(balance.used)-Number(balance.encashed);if(available<Number(req.days))throw new ValidationError('Insufficient leave balance.');await client.query('UPDATE hr_leave_balances SET used=used+$1 WHERE id=$2',[req.days,balance.id]);await client.query('INSERT INTO hr_leave_transactions(id,tenant_id,employee_id,leave_type_id,year,transaction_type,amount,reference_id,created_by) VALUES($1,$2,$3,$4,$5,\'USAGE\',$6,$7,$8)',[uuidV7(),c.tenantId,req.employee_id,req.leave_type_id,req.year,req.days,id,c.userId]);});}
 async initializeLeaveBalances(c:HrContext,employeeId:string,year:number){await this.auth(c,'leave_balance','create');if(!isUuid(employeeId)||!Number.isInteger(year)||year<2000||year>2200)throw new ValidationError('Valid employee and year are required.');return withTenantContext(this.pool,this.tenantKey,c.tenantId,async client=>{const types=(await client.query("SELECT id,annual_entitlement,accrual_method FROM hr_leave_types WHERE tenant_id=$1 AND status='ACTIVE'",[c.tenantId])).rows;const result=[];for(const type of types){const existing=(await client.query('SELECT id FROM hr_leave_balances WHERE tenant_id=$1 AND employee_id=$2 AND leave_type_id=$3 AND year=$4',[c.tenantId,employeeId,type.id,year])).rows[0];if(existing){result.push(existing);continue;}const accrued=String(type.accrual_method).toUpperCase()==='ANNUAL'?Number(type.annual_entitlement):0;const row=(await client.query('INSERT INTO hr_leave_balances(id,tenant_id,employee_id,leave_type_id,year,opening,accrued,used,encashed,adjusted) VALUES($1,$2,$3,$4,$5,0,$6,0,0,0) RETURNING *',[uuidV7(),c.tenantId,employeeId,type.id,year,accrued])).rows[0];if(accrued>0)await client.query("INSERT INTO hr_leave_transactions(id,tenant_id,employee_id,leave_type_id,year,transaction_type,amount,created_by) VALUES($1,$2,$3,$4,$5,'ACCRUAL',$6,$7)",[uuidV7(),c.tenantId,employeeId,type.id,year,accrued,c.userId]);result.push(row);}return result;});}

 async calculatePayroll(c:HrContext,runId:string){
  await this.auth(c,'payroll','calculate');
  if(!isUuid(runId))throw new ValidationError('Invalid payroll run id.');
  return withTenantContext(this.pool,this.tenantKey,c.tenantId,async client=>{
   const run=(await client.query('SELECT r.*,p.period_start,p.period_end FROM hr_payroll_runs r JOIN hr_payroll_periods p ON p.id=r.payroll_period_id WHERE r.id=$1 AND r.tenant_id=$2 FOR UPDATE',[runId,c.tenantId])).rows[0];
   if(!run)throw new NotFoundError('Payroll run not found.');
   if(['APPROVED','CLOSED'].includes(run.status))throw new ValidationError('Approved or closed payroll cannot be recalculated.');
   const emps=(await client.query('SELECT e.id,COALESCE(es.gross_monthly,0) gross,COALESCE(es.component_values,\'{}\') component_values FROM hr_employees e LEFT JOIN LATERAL(SELECT gross_monthly,component_values FROM hr_employee_salary x WHERE x.employee_id=e.id AND x.tenant_id=e.tenant_id AND x.effective_from<=$2 AND (x.effective_to IS NULL OR x.effective_to>=$1) ORDER BY x.effective_from DESC LIMIT 1) es ON true WHERE e.tenant_id=$3 AND e.is_deleted=false AND e.employment_status=\'ACTIVE\'',[run.period_start,run.period_end,c.tenantId])).rows;
   await client.query('DELETE FROM hr_payslips WHERE payroll_run_id=$1 AND tenant_id=$2',[runId,c.tenantId]);
   let grossTotal=0,deductionTotal=0;
   const days=(new Date(run.period_end).getTime()-new Date(run.period_start).getTime())/86400000+1;
   for(const e of emps){
    const attendance=Number((await client.query('SELECT COALESCE(SUM(CASE WHEN status=\'PRESENT\' THEN 1 WHEN status=\'HALF_DAY\' THEN 0.5 ELSE 0 END),0) days FROM hr_attendance WHERE tenant_id=$1 AND employee_id=$2 AND attendance_date BETWEEN $3 AND $4',[c.tenantId,e.id,run.period_start,run.period_end])).rows[0].days);
    const payable=attendance>0?Math.min(1,attendance/days):1;
    const adj=(await client.query('SELECT COALESCE(SUM(CASE WHEN adjustment_type IN (\'EARNING\',\'BONUS\',\'INCENTIVE\') THEN amount ELSE 0 END),0) earnings,COALESCE(SUM(CASE WHEN adjustment_type NOT IN (\'EARNING\',\'BONUS\',\'INCENTIVE\') THEN amount ELSE 0 END),0) deductions FROM hr_payroll_adjustments WHERE tenant_id=$1 AND employee_id=$2 AND payroll_period_id=$3 AND approved=true',[c.tenantId,e.id,run.payroll_period_id])).rows[0];
    const loan=Number((await client.query("SELECT COALESCE(SUM(LEAST(installment_amount,outstanding)),0) amount FROM hr_payroll_loans WHERE tenant_id=$1 AND employee_id=$2 AND status='ACTIVE'",[c.tenantId,e.id])).rows[0].amount);
    const reimbursement=Number((await client.query("SELECT COALESCE(SUM(amount),0) amount FROM hr_payroll_reimbursements WHERE tenant_id=$1 AND employee_id=$2 AND payroll_period_id=$3 AND status='APPROVED'",[c.tenantId,e.id,run.payroll_period_id])).rows[0].amount);
    const earning=Number(e.gross)*payable+Number(adj.earnings)+reimbursement; const deductions=Number(adj.deductions)+loan; grossTotal+=earning; deductionTotal+=deductions;
    await client.query('INSERT INTO hr_payslips(id,tenant_id,payroll_run_id,employee_id,gross,deductions,net,earnings,deduction_details,attendance_snapshot,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,\'CALCULATED\')',[uuidV7(),c.tenantId,runId,e.id,earning,deductions,earning-deductions,JSON.stringify({salary:Number(e.gross),adjustments:Number(adj.earnings),reimbursements:reimbursement,componentValues:e.component_values}),JSON.stringify({adjustments:Number(adj.deductions),loan}),JSON.stringify({attendanceDays:attendance,periodDays:days,payableFactor:payable})]);
   }
   return(await client.query("UPDATE hr_payroll_runs SET employee_count=$2,gross_total=$3,deduction_total=$4,net_total=$3::numeric-$4::numeric,status='CALCULATED',calculated_at=NOW() WHERE id=$1 RETURNING *",[runId,emps.length,grossTotal,deductionTotal])).rows[0];
  });
 }

 async closePayroll(c:HrContext,runId:string){await this.auth(c,'payroll','close');if(!isUuid(runId))throw new ValidationError('Invalid payroll run id.');return withTenantContext(this.pool,this.tenantKey,c.tenantId,async client=>{const q=await client.query("UPDATE hr_payroll_runs SET status='CLOSED',closed_at=NOW() WHERE id=$1 AND tenant_id=$2 AND status='APPROVED' RETURNING *",[runId,c.tenantId]);if(!q.rowCount)throw new ValidationError('Payroll run must be APPROVED before closing.');return q.rows[0];});}
 async finalizeAttendance(c:HrContext,attendanceId:string){await this.auth(c,'attendance','update');if(!isUuid(attendanceId))throw new ValidationError('Invalid attendance id.');return withTenantContext(this.pool,this.tenantKey,c.tenantId,async client=>{const q=await client.query("UPDATE hr_attendance SET finalized=true,updated_at=NOW() WHERE id=$1 AND tenant_id=$2 RETURNING *",[attendanceId,c.tenantId]);if(!q.rowCount)throw new NotFoundError('Attendance record not found.');return q.rows[0];});}
 async employeeExit(c:HrContext,employeeId:string,exitDate:string,reason?:string){await this.auth(c,'employee','update');if(!isUuid(employeeId)||!exitDate)throw new ValidationError('Employee and exit date are required.');return withTenantContext(this.pool,this.tenantKey,c.tenantId,async client=>{await client.query('BEGIN');try{const q=await client.query("UPDATE hr_employees SET employment_status='EXITED',exit_date=$1,updated_at=NOW(),version=version+1 WHERE id=$2 AND tenant_id=$3 AND is_deleted=false RETURNING *",[exitDate,employeeId,c.tenantId]);if(!q.rowCount)throw new NotFoundError('Employee not found.');const employee=q.rows[0];if(employee.user_id){await client.query("UPDATE users SET status='inactive',updated_at=NOW(),version=version+1 WHERE tenant_id=$1 AND id=$2",[c.tenantId,employee.user_id]);await client.query("UPDATE identities SET status='disabled',updated_at=NOW() WHERE id=$1",[employee.identity_id]);await client.query("UPDATE tenant_memberships SET status='revoked',revoked_at=NOW(),updated_at=NOW() WHERE tenant_id=$1 AND identity_id=$2",[c.tenantId,employee.identity_id]);await client.query("UPDATE auth_login_identifiers SET is_active=false WHERE tenant_id=$1 AND user_id=$2",[c.tenantId,employee.user_id]);await client.query("UPDATE user_sessions SET is_active=false,revoked_at=COALESCE(revoked_at,NOW()),logout_at=COALESCE(logout_at,NOW()),termination_reason='employee_exit',updated_at=NOW(),version=version+1 WHERE tenant_id=$1 AND user_id=$2 AND is_active=true",[c.tenantId,employee.user_id]);await client.query("INSERT INTO hr_access_history(id,tenant_id,employee_id,user_id,action,reason,changed_by) VALUES($1,$2,$3,$4,'REVOKE',$5,$6)",[uuidV7(),c.tenantId,employeeId,employee.user_id,reason??'Employee exit',c.userId]);}await client.query("INSERT INTO hr_employment_history(id,tenant_id,employee_id,effective_from,action,notes,created_by) VALUES($1,$2,$3,$4,'EXIT',$5,$6)",[uuidV7(),c.tenantId,employeeId,exitDate,reason??null,c.userId]);await client.query('COMMIT');return employee;}catch(error){await client.query('ROLLBACK');throw error;}});}
 async linkUser(c:HrContext,employeeId:string,userId:string){await this.auth(c,'employee','grant_access');if(!isUuid(employeeId)||!isUuid(userId))throw new ValidationError('Invalid employee or user id.');return withTenantContext(this.pool,this.tenantKey,c.tenantId,async client=>{const u=(await client.query('SELECT id,identity_id FROM users WHERE id=$1 AND tenant_id=$2 AND is_deleted=false',[userId,c.tenantId])).rows[0];if(!u)throw new NotFoundError('ERP user not found.');const q=await client.query('UPDATE hr_employees SET user_id=$1,identity_id=$2,updated_at=NOW(),version=version+1 WHERE id=$3 AND tenant_id=$4 RETURNING *',[u.id,u.identity_id,employeeId,c.tenantId]);if(!q.rowCount)throw new NotFoundError('Employee not found.');return q.rows[0];});}
 async workforceSummary(c:HrContext){await this.auth(c,'analytics','read');return withTenantContext(this.pool,this.tenantKey,c.tenantId,async client=>{const head=(await client.query("SELECT count(*)::int total,count(*) FILTER(WHERE employment_status='ACTIVE')::int active,count(*) FILTER(WHERE employment_status='EXITED')::int exited FROM hr_employees WHERE tenant_id=$1 AND is_deleted=false",[c.tenantId])).rows[0];const departments=(await client.query("SELECT d.id,d.code,d.name,count(e.id)::int headcount FROM hr_departments d LEFT JOIN hr_employees e ON e.department_id=d.id AND e.tenant_id=d.tenant_id AND e.is_deleted=false AND e.employment_status='ACTIVE' WHERE d.tenant_id=$1 AND d.is_deleted=false GROUP BY d.id,d.code,d.name ORDER BY d.name",[c.tenantId])).rows;return{headcount:head,departments};});}
 async approvePayroll(c:HrContext,runId:string){
  await this.auth(c,'payroll','approve'); if(!isUuid(runId))throw new ValidationError('Invalid payroll run id.');
  return withTenantContext(this.pool,this.tenantKey,c.tenantId,async client=>{
   const q=await client.query("UPDATE public.hr_payroll_runs SET status='APPROVED',approved_at=NOW(),approved_by=$1 WHERE id=$2 AND tenant_id=$3 AND status='CALCULATED' RETURNING *",[c.userId,runId,c.tenantId]);
   if(!q.rowCount)throw new ValidationError('Payroll run must be CALCULATED before approval.'); return q.rows[0];
  });
 }
 async postPayrollToFinance(c:HrContext,runId:string){
  await this.auth(c,'payroll','close'); if(!isUuid(runId))throw new ValidationError('Invalid payroll run id.');
  return withTenantContext(this.pool,this.tenantKey,c.tenantId,async client=>{
   const run=(await client.query("SELECT * FROM public.hr_payroll_runs WHERE id=$1 AND tenant_id=$2 AND status='CLOSED'",[runId,c.tenantId])).rows[0];
   if(!run)throw new ValidationError('Payroll run must be CLOSED before finance posting.');
   const existing=(await client.query('SELECT * FROM public.hr_finance_postings WHERE payroll_run_id=$1 AND tenant_id=$2',[runId,c.tenantId])).rows[0];
   if(existing)return existing;
   return (await client.query("INSERT INTO public.hr_finance_postings(id,tenant_id,payroll_run_id,posting_reference,status,payload) VALUES($1,$2,$3,$4,'PENDING',$5) RETURNING *",[uuidV7(),c.tenantId,runId,'HR-PAYROLL-'+runId,JSON.stringify({gross:run.gross_total,deductions:run.deduction_total,net:run.net_total})])).rows[0];
  });
 }
 async runLeaveAccrual(c:HrContext,year:number){
  await this.auth(c,'leave_accrual_run','create'); if(!Number.isInteger(year)||year<2000||year>2200)throw new ValidationError('Valid year is required.');
  return withTenantContext(this.pool,this.tenantKey,c.tenantId,async client=>{
   const existing=(await client.query('SELECT * FROM public.hr_leave_accrual_runs WHERE tenant_id=$1 AND year=$2 ORDER BY run_date DESC LIMIT 1',[c.tenantId,year])).rows[0];
   if(existing)return existing;
   const types=(await client.query("SELECT id,annual_entitlement,accrual_method FROM public.hr_leave_types WHERE tenant_id=$1 AND status='ACTIVE'",[c.tenantId])).rows;
   const employees=(await client.query("SELECT id FROM public.hr_employees WHERE tenant_id=$1 AND is_deleted=false AND employment_status='ACTIVE'",[c.tenantId])).rows;
   for(const e of employees)for(const t of types){
    const bal=(await client.query('SELECT * FROM public.hr_leave_balances WHERE tenant_id=$1 AND employee_id=$2 AND leave_type_id=$3 AND year=$4 FOR UPDATE',[c.tenantId,e.id,t.id,year])).rows[0];
    const accrued=String(t.accrual_method).toUpperCase()==='MONTHLY'?Number(t.annual_entitlement)/12:Number(t.annual_entitlement);
    if(bal)await client.query('UPDATE public.hr_leave_balances SET accrued=accrued+$1 WHERE id=$2',[accrued,bal.id]);
    else await client.query('INSERT INTO public.hr_leave_balances(id,tenant_id,employee_id,leave_type_id,year,opening,accrued,used,encashed,adjusted) VALUES($1,$2,$3,$4,$5,0,$6,0,0,0)',[uuidV7(),c.tenantId,e.id,t.id,year,accrued]);
   }
   return (await client.query("INSERT INTO public.hr_leave_accrual_runs(id,tenant_id,year,run_date,status,created_by) VALUES($1,$2,$3,CURRENT_DATE,'COMPLETED',$4) RETURNING *",[uuidV7(),c.tenantId,year,c.userId])).rows[0];
  });
 }
 async encashLeave(c:HrContext,employeeId:string,leaveTypeId:string,year:number,days:number,amount:number){
  await this.auth(c,'leave_encashment','create'); if(!isUuid(employeeId)||!isUuid(leaveTypeId)||days<=0||amount<0)throw new ValidationError('Valid employee, leave type, days and amount are required.');
  return withTenantContext(this.pool,this.tenantKey,c.tenantId,async client=>{
   const bal=(await client.query('SELECT * FROM public.hr_leave_balances WHERE tenant_id=$1 AND employee_id=$2 AND leave_type_id=$3 AND year=$4 FOR UPDATE',[c.tenantId,employeeId,leaveTypeId,year])).rows[0];
   if(!bal)throw new ValidationError('Leave balance is not initialized.');
   const available=Number(bal.opening)+Number(bal.accrued)+Number(bal.adjusted)-Number(bal.used)-Number(bal.encashed);
   if(available<days)throw new ValidationError('Insufficient leave balance for encashment.');
   await client.query('UPDATE public.hr_leave_balances SET encashed=encashed+$1 WHERE id=$2',[days,bal.id]);
   return (await client.query("INSERT INTO public.hr_leave_encashments(id,tenant_id,employee_id,leave_type_id,year,days,amount,status,approved_by,approved_at) VALUES($1,$2,$3,$4,$5,$6,$7,'APPROVED',$8,NOW()) RETURNING *",[uuidV7(),c.tenantId,employeeId,leaveTypeId,year,days,amount,c.userId])).rows[0];
  });
 }
 async approveAttendanceRegularization(c:HrContext,id:string){
  await this.auth(c,'attendance_regularization','update'); if(!isUuid(id))throw new ValidationError('Invalid regularization id.');
  return withTenantContext(this.pool,this.tenantKey,c.tenantId,async client=>{
   const r=(await client.query("UPDATE public.hr_attendance_regularizations SET status='APPROVED',approved_by=$1,approved_at=NOW() WHERE id=$2 AND tenant_id=$3 AND status IN ('DRAFT','SUBMITTED','PENDING') RETURNING *",[c.userId,id,c.tenantId])).rows[0];
   if(!r)throw new NotFoundError('Attendance regularization not found.');
   if(r.attendance_id)await client.query('UPDATE public.hr_attendance SET check_in=$1,check_out=$2,status=CASE WHEN $1 IS NULL THEN status ELSE \'PRESENT\' END,updated_at=NOW() WHERE id=$3 AND tenant_id=$4',[r.requested_check_in,r.requested_check_out,r.attendance_id,c.tenantId]);
   return r;
  });
 }
 async calculateOvertime(c:HrContext,employeeId:string,attendanceId:string,minutes:number,rate:number){
  await this.auth(c,'overtime_record','create'); if(!isUuid(employeeId)||!isUuid(attendanceId)||minutes<0||rate<0)throw new ValidationError('Valid overtime inputs are required.');
  return withTenantContext(this.pool,this.tenantKey,c.tenantId,async client=>{
   const a=(await client.query('SELECT attendance_date FROM public.hr_attendance WHERE id=$1 AND employee_id=$2 AND tenant_id=$3',[attendanceId,employeeId,c.tenantId])).rows[0];
   if(!a)throw new NotFoundError('Attendance record not found.');
   return (await client.query("INSERT INTO public.hr_overtime_records(id,tenant_id,employee_id,attendance_id,work_date,minutes,rate,amount,status) VALUES($1,$2,$3,$4,$5,$6,$7,$6*$7,'APPROVED') RETURNING *",[uuidV7(),c.tenantId,employeeId,attendanceId,a.attendance_date,minutes,rate])).rows[0];
  });
 }
 async acceptOffer(c:HrContext,id:string){
  await this.auth(c,'job_offer','update'); if(!isUuid(id))throw new ValidationError('Invalid offer id.');
  return withTenantContext(this.pool,this.tenantKey,c.tenantId,async client=>{const q=await client.query("UPDATE public.hr_job_offers SET status='ACCEPTED',accepted_at=NOW() WHERE id=$1 AND tenant_id=$2 AND status IN ('DRAFT','OFFERED','SENT') RETURNING *",[id,c.tenantId]);if(!q.rowCount)throw new NotFoundError('Offer not found or not actionable.');return q.rows[0];});
 }
 async completeTraining(c:HrContext,id:string,score?:number){
  await this.auth(c,'training_enrollment','update'); if(!isUuid(id))throw new ValidationError('Invalid enrollment id.');
  return withTenantContext(this.pool,this.tenantKey,c.tenantId,async client=>{const q=await client.query("UPDATE public.hr_training_enrollments SET status='COMPLETED',attendance_percent=GREATEST(attendance_percent,100) WHERE id=$1 AND tenant_id=$2 RETURNING *",[id,c.tenantId]);if(!q.rowCount)throw new NotFoundError('Training enrollment not found.');if(score!==undefined)await client.query('INSERT INTO public.hr_training_assessments(id,tenant_id,enrollment_id,assessment_date,score,passed) VALUES($1,$2,$3,CURRENT_DATE,$4,$5)',[uuidV7(),c.tenantId,id,score,score>=50]);return q.rows[0];});
 }
 async createExitSettlement(c:HrContext,employeeId:string,exitRecordId?:string){
  await this.auth(c,'payroll_settlement','create'); if(!isUuid(employeeId))throw new ValidationError('Invalid employee id.');
  return withTenantContext(this.pool,this.tenantKey,c.tenantId,async client=>{
   const salary=(await client.query('SELECT gross_monthly FROM public.hr_employee_salary WHERE tenant_id=$1 AND employee_id=$2 ORDER BY effective_from DESC LIMIT 1',[c.tenantId,employeeId])).rows[0];
   const gross=Number(salary?.gross_monthly??0);
   return (await client.query("INSERT INTO public.hr_payroll_settlements(id,tenant_id,employee_id,exit_record_id,settlement_date,earnings,deductions,net_amount,status,details) VALUES($1,$2,$3,$4,CURRENT_DATE,$5,0,$5,'CALCULATED',$6) RETURNING *",[uuidV7(),c.tenantId,employeeId,exitRecordId??null,gross,JSON.stringify({source:'latest_salary',note:'Final settlement is a calculation boundary; statutory/gratuity rules remain configuration-driven.'})])).rows[0];
  });
 }


 async resolveMissingPunch(c:HrContext,id:string,resolution:'REGULARIZED'|'ABSENT'|'OFF'|'LEAVE',reason?:string){
  await this.auth(c,'missing_punch_case','update'); if(!isUuid(id))throw new ValidationError('Invalid missing punch case id.');
  return withTenantContext(this.pool,this.tenantKey,c.tenantId,async client=>{
   const q=await client.query("UPDATE public.hr_missing_punch_cases SET status='RESOLVED',resolution_type=$1,resolved_at=NOW(),resolved_by=$2,reason=COALESCE($3,reason) WHERE id=$4 AND tenant_id=$5 AND status='OPEN' RETURNING *",[resolution,c.userId,reason??null,id,c.tenantId]);
   if(!q.rowCount)throw new NotFoundError('Open missing punch case not found.'); return q.rows[0];
  });
 }
 async importAttendance(c:HrContext,source:string,rows:Array<{employeeId:string;punchAt:string;direction:'IN'|'OUT';externalReference?:string}>){
  await this.auth(c,'attendance_import_batch','create'); if(!source||!Array.isArray(rows))throw new ValidationError('Attendance import source and rows are required.');
  return withTenantContext(this.pool,this.tenantKey,c.tenantId,async client=>{
   const batch=(await client.query("INSERT INTO public.hr_attendance_import_batches(id,tenant_id,source,row_count,created_by) VALUES($1,$2,$3,$4,$5) RETURNING *",[uuidV7(),c.tenantId,source,rows.length,c.userId])).rows[0];
   let ok=0,errors=0;
   for(const row of rows){
    try{
     if(!isUuid(row.employeeId)||!row.punchAt||!['IN','OUT'].includes(row.direction))throw new Error('Invalid attendance row');
     const at=new Date(row.punchAt); if(Number.isNaN(at.getTime()))throw new Error('Invalid punch timestamp');
     await client.query("INSERT INTO public.hr_attendance_import_rows(id,tenant_id,batch_id,employee_id,punch_at,direction,external_reference,status) VALUES($1,$2,$3,$4,$5,$6,$7,'IMPORTED')",[uuidV7(),c.tenantId,batch.id,row.employeeId,at,row.direction,row.externalReference??null]);
     await client.query("INSERT INTO public.hr_attendance_punches(id,tenant_id,employee_id,punched_at,direction,source,device_reference) VALUES($1,$2,$3,$4,$5,$6,$7)",[uuidV7(),c.tenantId,row.employeeId,at,row.direction,source,row.externalReference??null]);
     const date=at.toISOString().slice(0,10),field=row.direction==='IN'?'check_in':'check_out';
     await client.query("INSERT INTO public.hr_attendance(id,tenant_id,employee_id,attendance_date,"+field+",status,source) VALUES($1,$2,$3,$4,$5,'PRESENT',$6) ON CONFLICT(tenant_id,employee_id,attendance_date) DO UPDATE SET "+field+"=EXCLUDED."+field+",source=EXCLUDED.source,updated_at=NOW()",[uuidV7(),c.tenantId,row.employeeId,date,at,source]);
     ok++;
    }catch(e){errors++;await client.query("INSERT INTO public.hr_attendance_import_rows(id,tenant_id,batch_id,status,error_message) VALUES($1,$2,$3,'ERROR',$4)",[uuidV7(),c.tenantId,batch.id,e instanceof Error?e.message:'Invalid row']);}
   }
   return (await client.query("UPDATE public.hr_attendance_import_batches SET success_count=$2,error_count=$3,status=$4 WHERE id=$1 RETURNING *",[batch.id,ok,errors,errors?'PARTIAL':'COMPLETED'])).rows[0];
  });
 }
 async evaluateAttendance(c:HrContext,attendanceId:string){
  await this.auth(c,'attendance','update'); if(!isUuid(attendanceId))throw new ValidationError('Invalid attendance id.');
  return withTenantContext(this.pool,this.tenantKey,c.tenantId,async client=>{
   const a=(await client.query("SELECT a.*,s.start_time,s.end_time,s.grace_minutes,s.overtime_after_minutes FROM public.hr_attendance a LEFT JOIN public.hr_shifts s ON s.id=a.shift_id WHERE a.id=$1 AND a.tenant_id=$2",[attendanceId,c.tenantId])).rows[0];
   if(!a)throw new NotFoundError('Attendance record not found.');
   const old=a.status; let status='PRESENT';
   if(!a.check_in&&!a.check_out)status='ABSENT'; else if(!a.check_in||!a.check_out)status='MISSING_PUNCH';
   else if(a.start_time){const actual=new Date(a.check_in).getUTCHours()*60+new Date(a.check_in).getUTCMinutes();const [h,m]=String(a.start_time).slice(0,5).split(':').map(Number);if(actual>h*60+m+Number(a.grace_minutes??0))status='LATE';}
   if(a.check_in&&a.check_out){const mins=Math.max(0,Math.round((new Date(a.check_out).getTime()-new Date(a.check_in).getTime())/60000)-Number(a.break_minutes??0));await client.query("UPDATE public.hr_attendance SET worked_minutes=$1,overtime_minutes=GREATEST(0,$1-480),status=$2,updated_at=NOW() WHERE id=$3 AND tenant_id=$4",[mins,status,a.id,c.tenantId]);}
   else await client.query("UPDATE public.hr_attendance SET status=$1,updated_at=NOW() WHERE id=$2 AND tenant_id=$3",[status,a.id,c.tenantId]);
   if(old!==status)await client.query("INSERT INTO public.hr_attendance_state_history(id,tenant_id,attendance_id,from_status,to_status,reason,changed_by) VALUES($1,$2,$3,$4,$5,'RULE_EVALUATION',$6)",[uuidV7(),c.tenantId,a.id,old,status,c.userId]);
   if(status==='MISSING_PUNCH')await client.query("INSERT INTO public.hr_missing_punch_cases(id,tenant_id,employee_id,attendance_id,attendance_date,missing_direction) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING",[uuidV7(),c.tenantId,a.employee_id,a.id,a.attendance_date,a.check_in?'OUT':'IN']);
   return (await client.query("SELECT * FROM public.hr_attendance WHERE id=$1",[a.id])).rows[0];
  });
 }
 async runLeavePolicy(c:HrContext,year:number){
  await this.auth(c,'leave_policy_run','create'); if(!Number.isInteger(year))throw new ValidationError('Valid year is required.');
  return withTenantContext(this.pool,this.tenantKey,c.tenantId,async client=>{
   const types=(await client.query("SELECT * FROM public.hr_leave_types WHERE tenant_id=$1 AND status='ACTIVE'",[c.tenantId])).rows;
   const employees=(await client.query("SELECT id,joining_date FROM public.hr_employees WHERE tenant_id=$1 AND is_deleted=false AND employment_status='ACTIVE'",[c.tenantId])).rows;
   for(const e of employees)for(const t of types){
    const b=(await client.query("SELECT * FROM public.hr_leave_balances WHERE tenant_id=$1 AND employee_id=$2 AND leave_type_id=$3 AND year=$4 FOR UPDATE",[c.tenantId,e.id,t.id,year])).rows[0];
    if(!b)continue;
    const carry=Math.min(Number(b.opening)+Number(b.accrued)-Number(b.used)-Number(b.encashed),Number(t.carry_forward_limit??0));
    await client.query("UPDATE public.hr_leave_balances SET opening=$1,accrued=0,used=0,encashed=0 WHERE id=$2",[Math.max(0,carry),b.id]);
    if(t.expiry_months)await client.query("DELETE FROM public.hr_leave_transactions WHERE tenant_id=$1 AND employee_id=$2 AND leave_type_id=$3 AND year<$4 AND transaction_type='ACCRUAL'",[c.tenantId,e.id,t.id,year]);
   }
   return (await client.query("INSERT INTO public.hr_leave_policy_runs(id,tenant_id,year,run_date,carry_forward_applied,expiry_applied,status,created_by) VALUES($1,$2,$3,CURRENT_DATE,true,true,'COMPLETED',$4) RETURNING *",[uuidV7(),c.tenantId,year,c.userId])).rows[0];
  });
 }
 async validatePayroll(c:HrContext,runId:string){
  await this.auth(c,'payroll','calculate'); if(!isUuid(runId))throw new ValidationError('Invalid payroll run id.');
  return withTenantContext(this.pool,this.tenantKey,c.tenantId,async client=>{
   await client.query("DELETE FROM public.hr_payroll_validation_results WHERE payroll_run_id=$1 AND tenant_id=$2",[runId,c.tenantId]);
   const issues:any[]=[]; const run=(await client.query("SELECT * FROM public.hr_payroll_runs WHERE id=$1 AND tenant_id=$2",[runId,c.tenantId])).rows[0];
   if(!run)throw new NotFoundError('Payroll run not found.');
   if(Number(run.net_total)<0)issues.push(['ERROR','NEGATIVE_NET','Payroll net total cannot be negative',null]);
   if(Number(run.employee_count)!==(await client.query("SELECT count(*)::int n FROM public.hr_payslips WHERE payroll_run_id=$1 AND tenant_id=$2",[runId,c.tenantId])).rows[0].n)issues.push(['ERROR','EMPLOYEE_COUNT_MISMATCH','Payroll employee count does not match payslips',null]);
   const dup=(await client.query("SELECT employee_id,count(*) n FROM public.hr_payslips WHERE payroll_run_id=$1 AND tenant_id=$2 GROUP BY employee_id HAVING count(*)>1",[runId,c.tenantId])).rows;
   for(const d of dup)issues.push(['ERROR','DUPLICATE_PAYSLIP','Duplicate payslip for employee',d.employee_id]);
   for(const x of issues)await client.query("INSERT INTO public.hr_payroll_validation_results(id,tenant_id,payroll_run_id,severity,code,message,employee_id) VALUES($1,$2,$3,$4,$5,$6,$7)",[uuidV7(),c.tenantId,runId,...x]);
   const status=issues.some(x=>x[0]==='ERROR')?'FAILED':'PASSED'; await client.query("UPDATE public.hr_payroll_runs SET validation_status=$1 WHERE id=$2 AND tenant_id=$3",[status,runId,c.tenantId]);
   return {status,issues};
  });
 }
 async calculateStatutory(c:HrContext,runId:string){
  await this.auth(c,'statutory_calculation','create'); if(!isUuid(runId))throw new ValidationError('Invalid payroll run id.');
  return withTenantContext(this.pool,this.tenantKey,c.tenantId,async client=>{
   const run=(await client.query("SELECT * FROM public.hr_payroll_runs WHERE id=$1 AND tenant_id=$2",[runId,c.tenantId])).rows[0]; if(!run)throw new NotFoundError('Payroll run not found.');
   await client.query("DELETE FROM public.hr_statutory_calculations WHERE payroll_run_id=$1 AND tenant_id=$2",[runId,c.tenantId]);
   const rules=(await client.query("SELECT * FROM public.hr_statutory_rules WHERE tenant_id=$1 AND status='ACTIVE' AND effective_from<=CURRENT_DATE AND (effective_to IS NULL OR effective_to>=CURRENT_DATE)",[c.tenantId])).rows;
   const slips=(await client.query("SELECT * FROM public.hr_payslips WHERE payroll_run_id=$1 AND tenant_id=$2",[runId,c.tenantId])).rows; const out=[];
   for(const s of slips)for(const r of rules){const cfg=r.configuration??{};const baseKey=String(cfg.base??'gross');const base=baseKey==='net'?Number(s.net):baseKey==='basic'?Number((s.earnings??{}).basic??0):Number(s.gross);const cap=cfg.cap==null?base:Math.min(base,Number(cfg.cap));const employeeRate=Number(cfg.employeeRate??0);const employerRate=Number(cfg.employerRate??0);const employeeAmount=Number((cap*employeeRate/100).toFixed(2));const employerAmount=Number((cap*employerRate/100).toFixed(2));out.push((await client.query("INSERT INTO public.hr_statutory_calculations(id,tenant_id,payroll_run_id,employee_id,rule_id,base_amount,employee_amount,employer_amount,calculation) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *",[uuidV7(),c.tenantId,runId,s.employee_id,r.id,cap,employeeAmount,employerAmount,JSON.stringify({base:baseKey,employeeRate,employerRate,cap})])).rows[0]);}
   return out;
  });
 }
 async reversePayroll(c:HrContext,runId:string,reason:string){
  await this.auth(c,'payroll','close'); if(!isUuid(runId)||!reason?.trim())throw new ValidationError('Payroll run and reversal reason are required.');
  return withTenantContext(this.pool,this.tenantKey,c.tenantId,async client=>{
   const run=(await client.query("SELECT * FROM public.hr_payroll_runs WHERE id=$1 AND tenant_id=$2 AND status='CLOSED' FOR UPDATE",[runId,c.tenantId])).rows[0]; if(!run)throw new ValidationError('Only CLOSED payroll can be reversed.');
   const ref='REV-'+runId.slice(0,8)+'-'+Date.now(); const reversal=(await client.query("INSERT INTO public.hr_payroll_reversals(id,tenant_id,payroll_run_id,reversal_reference,reason,status,reversed_by,reversed_at) VALUES($1,$2,$3,$4,$5,'REVERSED',$6,NOW()) RETURNING *",[uuidV7(),c.tenantId,runId,ref,reason,c.userId])).rows[0];
   await client.query("UPDATE public.hr_payroll_runs SET status='REVERSED',reversed_at=NOW() WHERE id=$1 AND tenant_id=$2",[runId,c.tenantId]);
   await client.query("UPDATE public.hr_finance_postings SET status='REVERSED',posted_at=COALESCE(posted_at,NOW()) WHERE payroll_run_id=$1 AND tenant_id=$2",[runId,c.tenantId]);
   return reversal;
  });
 }
 async leaveCalendar(c:HrContext,startDate:string,endDate:string){
  await this.auth(c,'leave_request','read'); return withTenantContext(this.pool,this.tenantKey,c.tenantId,async client=>(await client.query("SELECT r.id,r.employee_id,r.leave_type_id,r.start_date,r.end_date,r.days,r.status,e.employee_no,e.first_name,e.last_name,t.code leave_code,t.name leave_name FROM public.hr_leave_requests r JOIN public.hr_employees e ON e.id=r.employee_id JOIN public.hr_leave_types t ON t.id=r.leave_type_id WHERE r.tenant_id=$1 AND r.status='APPROVED' AND r.start_date<=COALESCE($3,r.start_date) AND r.end_date>=COALESCE($2,r.end_date) ORDER BY r.start_date,e.employee_no",[c.tenantId,startDate||null,endDate||null])).rows);}
 async analyticsReport(c:HrContext,report:string,startDate?:string,endDate?:string){
  await this.auth(c,'analytics','read'); return withTenantContext(this.pool,this.tenantKey,c.tenantId,async client=>{
   const s=startDate||'1900-01-01',e=endDate||'2999-12-31';
   if(report==='attrition')return (await client.query("SELECT date_trunc('month',exit_date)::date month,count(*)::int exits FROM public.hr_employees WHERE tenant_id=$1 AND exit_date BETWEEN $2 AND $3 GROUP BY 1 ORDER BY 1",[c.tenantId,s,e])).rows;
   if(report==='absenteeism')return (await client.query("SELECT attendance_date,status,count(*)::int count FROM public.hr_attendance WHERE tenant_id=$1 AND attendance_date BETWEEN $2 AND $3 AND status IN ('ABSENT','MISSING_PUNCH') GROUP BY attendance_date,status ORDER BY attendance_date",[c.tenantId,s,e])).rows;
   if(report==='leave_utilization')return (await client.query("SELECT t.code,t.name,b.year,b.accrued,b.used,b.encashed,(b.opening+b.accrued+b.adjusted-b.used-b.encashed) available FROM public.hr_leave_balances b JOIN public.hr_leave_types t ON t.id=b.leave_type_id WHERE b.tenant_id=$1 ORDER BY b.year DESC,t.name",[c.tenantId])).rows;
   if(report==='overtime')return (await client.query("SELECT employee_id,work_date,SUM(minutes)::int minutes,SUM(amount)::numeric amount FROM public.hr_overtime_records WHERE tenant_id=$1 AND work_date BETWEEN $2 AND $3 GROUP BY employee_id,work_date ORDER BY work_date",[c.tenantId,s,e])).rows;
   if(report==='payroll_cost')return (await client.query("SELECT p.code,r.status,r.gross_total,r.deduction_total,r.net_total FROM public.hr_payroll_runs r JOIN public.hr_payroll_periods p ON p.id=r.payroll_period_id WHERE r.tenant_id=$1 AND p.period_start<=$3 AND p.period_end>=$2 ORDER BY p.period_start",[c.tenantId,s,e])).rows;
   if(report==='headcount')return (await client.query("SELECT employment_status,count(*)::int count FROM public.hr_employees WHERE tenant_id=$1 AND is_deleted=false GROUP BY employment_status",[c.tenantId])).rows;
   throw new ValidationError('Unsupported HR analytics report.');
  });
 }
 async finalizeAttendancePeriod(c:HrContext,startDate:string,endDate:string){
  await this.auth(c,'attendance','update'); return withTenantContext(this.pool,this.tenantKey,c.tenantId,async client=>{
   const rows=(await client.query("SELECT id FROM public.hr_attendance WHERE tenant_id=$1 AND attendance_date BETWEEN $2 AND $3 AND finalized=false",[c.tenantId,startDate,endDate])).rows;
   for(const r of rows)await client.query("UPDATE public.hr_attendance SET finalized=true,updated_at=NOW() WHERE id=$1",[r.id]);
   return {finalized:rows.length,startDate,endDate};
  });
 }


 async updateAccess(c:HrContext,employeeId:string,action:'SUSPEND'|'REVOKE'|'RESTORE',reason?:string){
  await this.auth(c,'employee','grant_access'); if(!isUuid(employeeId))throw new ValidationError('Invalid employee id.');
  return withTenantContext(this.pool,this.tenantKey,c.tenantId,async client=>{
   const e=(await client.query("SELECT id,user_id FROM public.hr_employees WHERE id=$1 AND tenant_id=$2",[employeeId,c.tenantId])).rows[0]; if(!e)throw new NotFoundError('Employee not found.'); if(!e.user_id)throw new ValidationError('Employee has no ERP access.');
   const status=action==='SUSPEND'?'suspended':action==='REVOKE'?'inactive':'active';
   await client.query("UPDATE public.users SET status=$1 WHERE id=$2 AND tenant_id=$3",[status,e.user_id,c.tenantId]);
   await client.query("INSERT INTO public.hr_access_history(id,tenant_id,employee_id,user_id,action,reason,changed_by) VALUES($1,$2,$3,$4,$5,$6,$7)",[uuidV7(),c.tenantId,employeeId,e.user_id,action,reason??null,c.userId]);
   return {employeeId,userId:e.user_id,action,status};
  });
 }
 async onboardingFromOffer(c:HrContext,offerId:string){
  await this.auth(c,'onboarding','create'); if(!isUuid(offerId))throw new ValidationError('Invalid offer id.');
  return withTenantContext(this.pool,this.tenantKey,c.tenantId,async client=>{
   const offer=(await client.query("SELECT o.*,a.candidate_id,a.requisition_id,c.name,c.email,c.phone FROM public.hr_job_offers o JOIN public.hr_applications a ON a.id=o.application_id JOIN public.hr_candidates c ON c.id=a.candidate_id WHERE o.id=$1 AND o.tenant_id=$2 AND o.status='ACCEPTED'",[offerId,c.tenantId])).rows[0];
   if(!offer)throw new NotFoundError('Accepted offer not found.');
   const existing=(await client.query("SELECT * FROM public.hr_applications a WHERE a.id=$1 AND a.hired_employee_id IS NOT NULL",[offer.application_id])).rows[0]; if(existing)throw new ValidationError('Candidate is already converted to an employee.');
   const employee=(await client.query("INSERT INTO public.hr_employees(id,tenant_id,employee_no,first_name,last_name,personal_email,phone,joining_date,employment_status,employment_type) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'ACTIVE','PERMANENT') RETURNING *",[uuidV7(),c.tenantId,'EMP-'+Date.now(),String(offer.name).split(' ')[0],String(offer.name).split(' ').slice(1).join(' ')||null,offer.email,offer.phone,offer.joining_date??new Date().toISOString().slice(0,10)])).rows[0];
   await client.query("UPDATE public.hr_applications SET status='HIRED',hired_employee_id=$1 WHERE id=$2",[employee.id,offer.application_id]);
   const onboarding=(await client.query("INSERT INTO public.hr_onboarding_records(id,tenant_id,employee_id,checklist,status,started_on) VALUES($1,$2,$3,'[]','OPEN',CURRENT_DATE) RETURNING *",[uuidV7(),c.tenantId,employee.id])).rows[0];
   await client.query("INSERT INTO public.hr_employment_history(id,tenant_id,employee_id,effective_from,action,new_value,created_by) VALUES($1,$2,$3,$4,'JOIN',jsonb_build_object('source','RECRUITMENT','offerId',$5),$6)",[uuidV7(),c.tenantId,employee.id,offer.joining_date??new Date().toISOString().slice(0,10),offerId,c.userId]);
   return {employee,onboarding};
  });
 }
 async ess(c:HrContext){
  await this.auth(c,'employee_request','read');
  return withTenantContext(this.pool,this.tenantKey,c.tenantId,async client=>{
   const e=(await client.query("SELECT * FROM public.hr_employees WHERE user_id=$1 AND tenant_id=$2 AND is_deleted=false",[c.userId,c.tenantId])).rows[0]; if(!e)throw new NotFoundError('No employee profile is linked to this ERP user.');
   const balances=(await client.query("SELECT b.*,t.code,t.name FROM public.hr_leave_balances b JOIN public.hr_leave_types t ON t.id=b.leave_type_id WHERE b.employee_id=$1 AND b.tenant_id=$2 ORDER BY b.year DESC,t.name",[e.id,c.tenantId])).rows;
   const attendance=(await client.query("SELECT * FROM public.hr_attendance WHERE employee_id=$1 AND tenant_id=$2 ORDER BY attendance_date DESC LIMIT 31",[e.id,c.tenantId])).rows;
   const payslips=(await client.query("SELECT p.* FROM public.hr_payslips p WHERE p.employee_id=$1 AND p.tenant_id=$2 ORDER BY p.created_at DESC LIMIT 12",[e.id,c.tenantId])).rows;
   const requests=(await client.query("SELECT * FROM public.hr_employee_requests WHERE employee_id=$1 AND tenant_id=$2 ORDER BY requested_at DESC LIMIT 20",[e.id,c.tenantId])).rows;
   return {employee:e,leaveBalances:balances,attendance,payslips,requests};
  });
 }
 async complianceSweep(c:HrContext,days=30){
  await this.auth(c,'compliance','update'); const horizon=Math.max(0,Math.min(365,days));
  return withTenantContext(this.pool,this.tenantKey,c.tenantId,async client=>{
   const expiry=(await client.query("SELECT id,employee_id,document_type,expiry_date FROM public.hr_employee_documents WHERE tenant_id=$1 AND expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE+$2::int ORDER BY expiry_date",[c.tenantId,horizon])).rows;
   for(const d of expiry)await client.query("INSERT INTO public.hr_compliance_tasks(id,tenant_id,employee_id,task_type,due_date,status,details) VALUES($1,$2,$3,'DOCUMENT_EXPIRY',$4,'OPEN',$5)",[uuidV7(),c.tenantId,d.employee_id,d.expiry_date,JSON.stringify({documentId:d.id,documentType:d.document_type})]);
   const cert=(await client.query("SELECT c.id,e.employee_id,c.expires_on FROM public.hr_training_certificates c JOIN public.hr_training_enrollments e ON e.id=c.enrollment_id WHERE c.tenant_id=$1 AND c.expires_on BETWEEN CURRENT_DATE AND CURRENT_DATE+$2::int",[c.tenantId,horizon])).rows;
   for(const x of cert)await client.query("INSERT INTO public.hr_compliance_tasks(id,tenant_id,employee_id,task_type,due_date,status,details) VALUES($1,$2,$3,'TRAINING_EXPIRY',$4,'OPEN',$5)",[uuidV7(),c.tenantId,x.employee_id,x.expires_on,JSON.stringify({certificateId:x.id})]);
   return {documents:expiry.length,certificates:cert.length,horizonDays:horizon};
  });
 }


 async cancelLeave(c:HrContext,id:string,reason:string){
  await this.auth(c,'leave_cancellation','create'); if(!isUuid(id)||!reason?.trim())throw new ValidationError('Leave request and cancellation reason are required.');
  return withTenantContext(this.pool,this.tenantKey,c.tenantId,async client=>{
   const req=(await client.query("SELECT * FROM public.hr_leave_requests WHERE id=$1 AND tenant_id=$2 FOR UPDATE",[id,c.tenantId])).rows[0]; if(!req)throw new NotFoundError('Leave request not found.');
   if(!['APPROVED','PENDING'].includes(req.status))throw new ValidationError('Leave request is not cancellable.');
   if(req.status==='APPROVED'){
    const year=new Date(req.start_date).getUTCFullYear();
    await client.query("UPDATE public.hr_leave_balances SET used=GREATEST(0,used-$1) WHERE tenant_id=$2 AND employee_id=$3 AND leave_type_id=$4 AND year=$5",[req.days,c.tenantId,req.employee_id,req.leave_type_id,year]);
    await client.query("INSERT INTO public.hr_leave_transactions(id,tenant_id,employee_id,leave_type_id,year,transaction_type,amount,reference_id,reason,created_by) VALUES($1,$2,$3,$4,$5,'CANCELLATION',$6,$7,$8,$9)",[uuidV7(),c.tenantId,req.employee_id,req.leave_type_id,year,req.days,id,reason,c.userId]);
   }
   await client.query("UPDATE public.hr_leave_requests SET status='CANCELLED',cancelled_at=NOW() WHERE id=$1 AND tenant_id=$2",[id,c.tenantId]);
   return (await client.query("INSERT INTO public.hr_leave_cancellations(id,tenant_id,leave_request_id,reason,status,approved_by,approved_at) VALUES($1,$2,$3,$4,'APPROVED',$5,NOW()) RETURNING *",[uuidV7(),c.tenantId,id,reason,c.userId])).rows[0];
  });
 }

}
