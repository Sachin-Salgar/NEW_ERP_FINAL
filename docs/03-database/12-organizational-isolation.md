# 12. Organizational Isolation

## 13.2 Hierarchy
Data is isolated at multiple logical levels within a single Tenant:
1. **Tenant**: Security and data-isolation boundary for the ERP installation or customer account.
2. **Organization**: Legal business entity or operating company within the tenant.
3. **Branch**: Operational business unit belonging to an organization.
4. **Location**: Physical site, plant, warehouse, or operational context belonging to an organization.
5. **Financial Year**: Accounting period (2025-26).

The project architecture defines a separation between tenancy and business organization. A tenant is not the same as an organization. The organization sits inside the tenant and owns the business/legal identity, tax registrations, and business configuration. Branch and Location are operational contexts inside the organization and are not tenant boundaries. Branch and Location are siblings under Organization; neither is a child of the other.

### Identity, User, and Organization Relationship
- **Authentication identity** proves who the caller is.
- **Application user** is the ERP user record linked to that identity.
- **Tenant membership** is the relationship proving the user has access to a tenant and permitted organizations within that tenant.
- **Organization membership** links a user to the organizations they may access.
- **Role** and **Permission** are assigned within an organization/tenant scope.
- **Branch access** and **Location access** determine which operational contexts a user may work within.
- **Active working context** is the current tuple of `tenantId`, `organizationId`, `branchId`, and `locationId` selected for the request or session.
- **Active location** remains operational context within the selected organization and tenant, and does not replace either boundary.

### Canonical Identity and Context Model

The ERP architecture requires the following conceptual boundaries to remain distinct and authoritative:

- **Identity** — the authenticated identity provider record or credential subject that proves who the caller is.
- **User** — the ERP application user record associated with that identity.
- **Tenant** — the security and data-isolation boundary.
- **Organization** — the business/legal entity within a tenant.
- **Branch** — the operational business unit within an organization.
- **Location** — the physical operating site, plant, or warehouse within an organization.
- **OrganizationMembership** — the relationship between a user and an organization, including role/permission eligibility.
- **Role** — organization-scoped or tenant-scoped assignment that bundles permissions.
- **Permission** — explicit action or capability granted to the user within the relevant scope.
- **ActiveOrganizationContext** — the organization selected or resolved for the current request/session.
- **ActiveBranchContext** — the branch selected or resolved for the current request/session.
- **ActiveLocationContext** — the location selected or resolved for the current request/session.
- **Session / EffectiveContext** — the server-authoritative context containing identity, user, tenant, roles, permissions, and the selected organization/branch/location tuple for processing.
- **TenantContext** — the backend-generated security context that authoritatively defines the tenant and related request scope used to begin the tenant-scoped database transaction.

This model is the implementation contract. A user is not equal to a tenant, a location is not a tenant, and organization membership is not the same as tenant ownership. Authentication identifies the user; tenant resolution determines the tenant scope; organization, branch, and location resolution determine the effective business context within that scope. The backend validates the full tuple before it becomes active.

A user may belong to multiple organizations within the same tenant. If multiple organizations are available, the active organization must be resolved explicitly before the request begins a tenant-scoped transaction. Unauthorized organization, branch, or location selection is rejected. Switching context affects the subsequent request context and must not leak prior tenant scope across requests.

## 13.3 Tenant → Organization → Branch + Location Model
The authoritative model is:

```text
Tenant
  └── Organization
       ├── Branch (operational business unit)
       └── Location (physical site / warehouse / plant)
```

Branch and Location are siblings under Organization. The effective working context is `tenantId + organizationId + branchId + locationId`. This model keeps the tenant as the primary RLS and security boundary while allowing organizations, branches, and locations to be modeled as business-scoped entities within the same database. Organization, branch, and location access are authorization concerns; they do not replace tenant isolation.

### Default user context

The current persisted defaults are:

- `users.organization_id` → default Organization
- `users.default_branch_id` → default Branch
- `users.default_location_id` → default Location

There is no `users.default_organization_id`; `users.organization_id` already represents the user's default Organization. Migration `0006-default-location-context.sql` adds the tenant-safe default location relationship.

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
