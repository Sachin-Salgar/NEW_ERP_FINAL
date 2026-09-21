# HR Module Implementation Status

The HR module is implemented inside the ERP modular monolith and follows the canonical tenant, identity, authorization, RLS, Workflow/BPM, notification, document and reporting boundaries.

Implemented persistence domains include organization (business units, divisions, departments, sections, teams and positions); employee lifecycle (employee master, employment history, skills, documents, onboarding, ERP-access linkage, exit records and employee relations); time (shifts, assignments, holidays, attendance punches/records/corrections); leave (types, policies, balances, transaction ledger and requests); payroll (salary components/structures, employee salary, periods, runs, payslips, adjustments, loans, reimbursements and versioned statutory rules); recruitment; performance; learning; compliance; and ESS requests.

Implemented API capabilities include authorized tenant-scoped CRUD, attendance check-in/check-out/finalization, leave balance consumption on approval, payroll calculation and close lifecycle, employee exit lifecycle, workforce summary analytics, and explicit employee-to-ERP access linking through the existing Identity/User registration boundary.

Approval-bearing HR processes are submitted to the single canonical Workflow/BPM engine using document types HR_LEAVE_REQUEST, HR_RECRUITMENT_REQUISITION, HR_PAYROLL_RUN, HR_ATTENDANCE_CORRECTION, HR_EMPLOYEE_REQUEST, HR_PAYROLL_REIMBURSEMENT and HR_PAYROLL_LOAN. HR contains no module-local approval engine.

Payroll calculation is deterministic from configured salary, attendance, adjustment, loan and reimbursement inputs. Statutory behavior remains configuration-driven; no universal tax, PF, ESI, professional-tax, banking or payment-provider assumptions are embedded.

Financial posting remains an integration boundary: HR owns payroll calculation and payroll records, while Finance owns accounting persistence and posting semantics.

The frontend exposes HR employee, organization, attendance, leave, payroll, recruitment, performance, training, compliance, ESS and reporting workspaces. Backend authorization remains the security boundary.
