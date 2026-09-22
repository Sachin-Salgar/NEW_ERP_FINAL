# HR Module Implementation Status

The HR module is implemented inside the ERP modular monolith and follows the canonical tenant, identity, authorization, RLS, Workflow/BPM, notification, document and reporting boundaries.

Implemented persistence domains include organization (business units, divisions, departments, sections, teams and positions); employee lifecycle (employee master, employment history, skills, documents, onboarding, ERP-access linkage, exit records and employee relations); time (shifts, assignments, holidays, attendance punches/records/corrections); leave (types, policies, balances, transaction ledger and requests); payroll (salary components/structures, employee salary, periods, runs, payslips, adjustments, loans, reimbursements and versioned statutory rules); recruitment; performance; learning; compliance; and ESS requests.

Implemented API capabilities include authorized tenant-scoped CRUD, attendance check-in/check-out/finalization, leave balance consumption on approval, payroll calculation and close lifecycle, employee exit lifecycle, workforce summary analytics, and explicit employee-to-ERP access linking through the existing Identity/User registration boundary.

Approval-bearing HR processes are submitted to the single canonical Workflow/BPM engine using document types HR_LEAVE_REQUEST, HR_RECRUITMENT_REQUISITION, HR_PAYROLL_RUN, HR_ATTENDANCE_CORRECTION, HR_EMPLOYEE_REQUEST, HR_PAYROLL_REIMBURSEMENT and HR_PAYROLL_LOAN. HR contains no module-local approval engine.

Payroll calculation is deterministic from configured salary, attendance, adjustment, loan and reimbursement inputs. Statutory behavior remains configuration-driven; no universal tax, PF, ESI, professional-tax, banking or payment-provider assumptions are embedded.

Financial posting remains an integration boundary: HR owns payroll calculation and payroll records, while Finance owns accounting persistence and posting semantics.

The frontend exposes HR employee, organization, attendance, leave, payroll, recruitment, performance, training, compliance, ESS and reporting workspaces. Backend authorization remains the security boundary.


## ERP Access and Identity Boundary (Current Implementation)

HR employee records and ERP access are intentionally separate concerns.

An Employee may exist without an ERP login. When authorized access is granted, HR uses the canonical platform identity/access boundary:

Employee
→ Identity
→ Tenant Membership
→ ERP User
→ Roles / Branch Access / Permissions

Employee creation does not automatically create an ERP user.

The HR access lifecycle is exposed through tenant administration and HR-aware access history. Supported operations include provisioning access, suspension, revocation, restoration, branch access assignment/revocation, and invitation/password lifecycle through the existing account-security mechanism.

ERP users who are not HR employees remain valid platform users. Tenant administration is the canonical non-HR entry point for such users; HR must not become a universal user-provisioning system.

## Current HR Feature-to-Implementation Map

| HR capability | Current working behavior | Primary implementation |
|---|---|---|
| Employee Master | Employee CRUD/lifecycle, employment history, skills, documents | hr-service + HR repositories/routes |
| Organization | Business units, divisions, departments, sections, teams, positions | hr-service + organization persistence |
| ERP Access | Explicit employee-to-identity/user linking and lifecycle | identity-provisioning-service + tenant-administration routes |
| Recruitment | Requisitions, openings, candidates/applications, interviews, offers, accepted-offer onboarding | hr-service |
| Attendance | Punches, evaluation, correction, import, finalization, shifts/holidays | hr-service |
| Leave | Types, policies, balances, requests, approval/cancellation, calendar/policy processing | hr-service |
| Payroll | Salary structures, periods/runs, calculation, validation, close, reversal, payslips, adjustments, loans/reimbursements | hr-service |
| Statutory | Versioned configuration and configuration-driven calculation | hr-service + HR migrations |
| ESS | Current employee-scoped ESS operations and approved requests | hr-service + HR routes |
| Performance | Performance cycles/goals/assessments | hr-service |
| Learning/Training | Training and learning records/certification | hr-service |
| Compliance/Employee Relations | Compliance tasks and ER records | hr-service |
| Reporting | Workforce/HR summary reporting | hr-service/reporting routes |
| Workflow | Approval-bearing HR processes use canonical Workflow/BPM; no HR-local engine | workflow-service + HR integration |

### Evidence requirements

A capability is considered fully documented only when its owning specification explains its business purpose, lifecycle, validation/invariants, authorization, persistence ownership, API/application contract, workflow behavior where applicable, audit/transaction semantics, frontend entry point, tests, and known limitations.

Architecture-only or future HR capabilities must be labelled as such and must not be described as available functionality.
