# HR Module Implementation Status

The HR module is implemented inside the ERP modular monolith and uses the canonical tenant, identity, authorization, RLS, workflow, notification, document, and reporting boundaries.

Implemented persistence domains include employee master, organization, positions, employment history, shifts, holidays, attendance punches/records/corrections, leave types/balances/requests, salary components and structures, employee salary, payroll periods/runs/payslips/adjustments, recruitment requisitions/candidates/applications/interviews, performance cycles/reviews, training programs/records, compliance records, and employee self-service requests.

Implemented API capabilities include authorized tenant-scoped CRUD, attendance check-in/check-out and finalization, payroll calculation/approval/close lifecycle, employee exit lifecycle, workforce summary analytics, and explicit employee-to-ERP access linking through the existing Identity/User registration boundary.

HR permissions use the hr.* namespace and the module is tenant-entitled through the existing tenant_modules mechanism. HR does not create a competing authentication or employee identity system.

Statutory payroll behavior remains configuration-driven. No universal tax, PF, ESI, professional-tax, or banking assumptions are embedded in the module.

The implementation must continue to expand business-specific UI and integrations without bypassing these ownership boundaries.
