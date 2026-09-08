# 12. Tenant and Branch Data Isolation

## 12.1 Hierarchy

The current ERP hierarchy is:

```text
Platform
  └── Tenant
       ├── Branch
       │    ├── Users
       │    ├── Roles
       │    └── Data
       └── Branch
            ├── Users
            ├── Roles
            └── Data
```

Platform is the system-level administrative boundary. Tenant is the security,
authorization, and data-isolation boundary. Branch is a business subdivision inside
the tenant and is not an independent security or RLS boundary.

## 12.2 User and authorization relationship

- An application user belongs to exactly one tenant.
- Normal application login establishes that tenant automatically.
- Tenant switching and multi-tenant user context selection are not supported.
- Roles and permissions are evaluated within the authenticated tenant.
- Branch access is evaluated only when a domain operation genuinely requires a
  branch-level distinction.

## 12.3 Data rules

Tenant-owned records must carry `tenant_id` and belong to exactly one tenant.
Domain records that require branch distinction may also carry `branch_id`. A
`branch_id` does not replace `tenant_id` and does not create a separate RLS boundary.

All tenant-owned operations use the trusted server-side TenantContext and a
transaction-local `app.current_tenant_id`. PostgreSQL RLS remains the final
tenant-isolation enforcement layer.

## 12.4 Prohibited architecture

The current architecture does not define Organisation, Location, tenant-as-branch
relationships, tenant switching, or multi-tenant application-user context selection.
Those concepts must not be introduced into current architecture or database
documentation.
