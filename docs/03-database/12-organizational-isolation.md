# 12. Organizational Isolation

## 13.2 Hierarchy
Data is isolated at multiple logical levels within a single Tenant:
1. **Tenant**: Security and data-isolation boundary for the ERP installation or customer account.
2. **Organization**: Legal business entity or operating company within the tenant.
3. **Location / Plant / Branch**: Operational unit belonging to an organization (for example Pune, CSN, warehouse, branch, head office).
4. **Financial Year**: Accounting period (2025-26).

The project architecture defines a separation between tenancy and business organization. A tenant is not the same as an organization. The organization sits inside the tenant and owns the business/legal identity, tax registrations, and business configuration. A location is operational context within the organization and is not a tenant boundary.

### Identity, User, and Organization Relationship
- **Authentication identity** proves who the caller is.
- **Application user** is the ERP user record linked to that identity.
- **Tenant membership** is the relationship proving the user has access to a tenant and permitted organizations within that tenant.
- **Organization membership** links a user to the organizations they may access.
- **Role** and **Permission** are assigned within an organization/tenant scope.
- **Location access** determines which operational locations a user may work within.
- **Active organization / tenant context** is the specific organization/tenant selected or resolved for the current request.
- **Active location** is operational context used by location-sensitive screens or transactions, but it does not replace the tenant or organization boundary.

### Canonical Identity and Context Model

The ERP architecture requires the following conceptual boundaries to remain distinct and authoritative:

- **Identity** — the authenticated identity provider record or credential subject that proves who the caller is.
- **User** — the ERP application user record associated with that identity.
- **Tenant** — the security and data-isolation boundary.
- **Organization** — the business/legal entity within a tenant.
- **OrganizationMembership** — the relationship between a user and an organization, including role/permission eligibility.
- **Location / Plant / Branch** — operational context inside an organization.
- **Role** — organization-scoped or tenant-scoped assignment that bundles permissions.
- **Permission** — explicit action or capability granted to the user within the relevant scope.
- **ActiveOrganizationContext** — the organization selected or resolved for the current request/session.
- **ActiveLocationContext** — the operational location selected or resolved for the current request/session.
- **Session / EffectiveContext** — the server-authoritative context containing identity, user, tenant, roles, permissions, active organization, and active location for processing.
- **TenantContext** — the backend-generated security context that authoritatively defines the tenant and related request scope used to begin the tenant-scoped database transaction.

This model is the implementation contract. A user is not equal to a tenant, a location is not a tenant, and organization membership is not the same as tenant ownership. Authentication and tenant resolution are separate operations. Authentication identifies the user; tenant resolution determines the deployment/tenant scope; organization and location resolution determine the effective business context within that scope.

A user may belong to multiple organizations within the same tenant or across different tenant memberships when the platform architecture permits it. If multiple organizations are available, the active organization must be resolved explicitly before the request begins a tenant-scoped transaction. Unauthorized organization selection is rejected. Switching organizations affects the subsequent request context and must not leak prior tenant scope across requests.

## 13.3 Tenant → Organization → Location Model
The authoritative model is:

```text
Tenant
  └── Organization
       ├── Legal / Business Identity
       ├── Tax Registrations
       ├── Locations / Plants / Branches
       └── Users + Memberships
```

This model keeps the tenant as the primary RLS and security boundary while allowing organizations and locations to be modeled as business-scoped entities within the same database. Location access is a permissions concern; it is not a substitute for tenant isolation.

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
