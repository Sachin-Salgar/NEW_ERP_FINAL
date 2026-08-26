# Implementation Roadmap Amendment — 2026-08-26

This amendment records the evidence-backed status of the authentication-context and module-access slice while preserving the existing canonical roadmap file's historical ledger.

## Completed implementation slice

### CORE-01 authentication context

- Tenant bootstrap remains the first trusted context step.
- Initial authentication no longer establishes an active organization when the user has multiple organization memberships.
- Organization selection creates the effective organization-scoped session.
- Location access is unavailable without an active organization.
- Location selection creates the effective organization + location session.

### Authorization and module access

- Effective permission evaluation now requires an explicitly enabled `tenant_modules` row for the permission's `module_code`.
- Backend permission middleware enforces module enablement and user authorization together.
- Frontend effective authorization consumes the module-aware endpoint.
- Authorized module metadata is returned with effective permissions.

### Validation

- `tests/integration/login-context-flow.test.ts` covers the organization-before-location sequence.
- `tests/integration/authorization-flow.test.ts` covers module disable → deny and module restore → allow.
- `frontend/integration_test/login_tenant_auth_e2e_test.dart` covers tenant bootstrap, login, effective module state and RBAC denial.
- CI workflow run for the implementation branch is the final validation gate before merge.

## Roadmap interpretation

The existing CORE-01.20 item described the first frontend-to-backend E2E validation as not started. This amendment supersedes that status for the authentication/RBAC slice: the first real tenant/login/authorization E2E exists and is being validated in the Postgres-backed CI workflow.

The remaining CORE-01 work is not silently marked complete. Security audit, broader business-module coverage, and final CORE-01 completion remain separate gates.

## Related authority

- `docs/10-adr/0010-login-context-and-module-access.md`
- `docs/04-backend/08-login-context-and-module-access-implementation.md`
- `.ai/repository-map.md`
