# 12. Organizational Isolation

## 13.2 Hierarchy
Data is isolated at multiple logical levels within a single Tenant:
1. **Tenant**: Legal contract boundary (SaaS customer).
2. **Organization**: Legal business entity (Company).
3. **Branch**: Operational unit (Mumbai Office).
4. **Financial Year**: Accounting period (2025-26).

## 13.6 Mandatory References
Transactional records must reference this hierarchy to support granular reporting:
- `tenant_id`
- `organization_id`
- `branch_id`
- `financial_year_id`

## 13.11 Year-End Closing
Once a Financial Year is closed:
- No new transactions can be created in that period.
- Existing transactions become read-only.
- Balances are carried forward via system-generated journal entries.
