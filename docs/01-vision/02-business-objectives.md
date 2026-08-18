# Business Objectives

**Document Purpose**: Define the five primary business objectives that drive ERP architectural decisions and capability scope.

**Audience**: Business stakeholders, architects, product managers, development leadership

---

## Introduction

Business objectives define what the ERP platform must accomplish from the perspective of the organization and end users. These objectives are the "why" behind architectural decisions.

The five business objectives presented in this document are the primary drivers of the ERP architecture. Every major architectural decision should advance one or more of these objectives.

---

## Objective 1: Unified Business Platform

**Statement**: Provide a single platform capable of managing all business operations including Sales, Purchase, Inventory, Manufacturing, Accounting, Human Resources, Payroll, Assets, Customer Relationship Management, and Reporting.

### Rationale

Historically, organizations have assembled business software from multiple vendors:
- One system for sales
- One for purchasing
- One for inventory
- One for accounting
- One for HR
- One for reporting

This approach creates:
- Duplicate master data (customers, suppliers, employees appear in multiple systems)
- Data synchronization problems (inconsistencies between systems)
- Complex integrations (point-to-point connections difficult to maintain)
- Fragmented reporting (customers exist in CRM with one identifier, accounting with another)
- High operational complexity (multiple logins, multiple interfaces, multiple vendors)

### Solution

The ERP provides one integrated platform where:
- All business data is stored in a single repository
- All users access the same authoritative customer, supplier, and employee records
- A sale automatically updates inventory and accounting
- Manufacturing automatically consumes inventory and generates costs
- HR automatically feeds payroll
- All reporting draws from a single source

### Benefit

Organizations achieve:
- **Single source of truth**: One definition of each business entity
- **Operational efficiency**: Reduced manual data entry and reconciliation
- **Data consistency**: No out-of-sync systems
- **Integrated reporting**: Unified view of operations
- **Faster decision-making**: Current information across all functions
- **Lower operational cost**: One vendor, one implementation, one support contract

### Scope

The unified platform includes:

| Module | Purpose |
|--------|---------|
| **Sales** | Order management, invoicing, sales analytics |
| **Purchase** | PO management, receipt, invoice matching |
| **Inventory** | Stock management, warehousing, goods movement |
| **Manufacturing** | Production planning, work orders, routing |
| **Accounting** | General ledger, AP, AR, financial reporting |
| **Human Resources** | Employee data, organization structure, recruitment |
| **Payroll** | Salary management, tax, benefits |
| **Assets** | Fixed asset management, depreciation |
| **CRM** | Customer management, interactions, opportunities |
| **Reporting** | Business reports, analytics, KPIs |

---

## Objective 2: Modular Licensing

**Statement**: Organizations shall subscribe only to the modules they require. The ERP platform shall dynamically adapt its interface and available functionality based on the licensed modules.

### Rationale

Not every organization requires every ERP module. A small retail business needs Sales and Inventory but not Manufacturing. A trading company needs Purchase and Inventory but not Manufacturing. A service organization needs HR and Accounting but not Manufacturing or Inventory.

Traditional ERP vendors charge for the entire system. The Enterprise ERP System charges only for what is used.

### Solution

Organizations select the modules they need at implementation time:
- **Required**: Organization, Branch, Accounting, HR, Payroll (core platform)
- **Optional**: Sales, Purchase, Inventory, Manufacturing, Assets, CRM, and future modules

The platform automatically:
- Hides menu items for unlicensed modules
- Removes API endpoints for unlicensed modules
- Restricts data access to licensed modules
- Charges licensing fees only for enabled modules

### Benefits

- **Cost control**: Pay only for what is used
- **Simplicity**: Users see only relevant functionality
- **Future flexibility**: Organizations can add modules as they grow
- **Modular updates**: Module updates don't affect unrelated organizations
- **Competitive pricing**: Lower entry cost than full-suite competitors

### Implementation

Module licensing is managed through:
- **Entitlement service**: Determines which modules are licensed for each organization
- **API gate**: Enforces module access at API layer
- **UI routing**: Hides module menus and screens for unlicensed modules
- **Audit logging**: Records module access for compliance

### Future Modules

The architecture supports adding new modules without modifying core or existing modules. Future modules might include:
- Fixed Assets
- Supply Chain Planning
- Quality Management
- Project Accounting
- Advanced Analytics
- Localization modules
- Industry-specific modules

---

## Objective 3: Multi-Tenant Platform

**Statement**: The ERP shall support multiple organizations using the same application instance while ensuring complete logical isolation of data. Each organization shall have independent Users, Branches, Financial Years, Settings, Permissions, Transactions, and Reports. No organization shall be capable of accessing another organization's information.

### Rationale

Running separate instances for each organization is expensive:
- Each instance requires separate hardware
- Each instance requires separate updates and maintenance
- Each instance duplicates infrastructure and databases
- Operational complexity increases with customer count

A multi-tenant platform:
- Shares infrastructure across organizations
- Reduces operational cost
- Enables rapid scaling
- Provides economies of scale

### Solution

The ERP implements a shared-schema multi-tenant model where:
- Single PostgreSQL database serves all organizations
- Every table includes a `tenant_id` column
- Row-Level Security (RLS) policies restrict access to rows for the current organization
- Users belong to one organization
- Every API includes tenant context
- Every audit record is tenant-scoped

### Data Isolation

Complete logical isolation means:

| Entity | Isolation | Owner |
|--------|-----------|-------|
| **Users** | Each organization has independent user accounts | Each organization |
| **Permissions** | Each organization defines independent roles and permissions | Each organization |
| **Data** | Each organization's transactions are invisible to other organizations | Each organization |
| **Branches** | Each organization has independent branches | Each organization |
| **Financial Years** | Each organization has independent fiscal years | Each organization |
| **Master Data** | Customers, suppliers, employees are organization-specific | Each organization |
| **Configuration** | Each organization configures taxes, approval levels, workflows | Each organization |
| **Reports** | Each organization sees only its data in reports | Each organization |
| **Backups** | Organizations can be restored independently | Platform |
| **Audit Logs** | Audit logs are organization-scoped | Each organization |

### Multi-Tenant Benefits

- **Deployment cost**: Single instance serves many organizations
- **Operational simplicity**: One database, one server infrastructure to manage
- **Version consistency**: All organizations run the same version
- **Resource efficiency**: Shared infrastructure scales with total usage
- **Data isolation**: Organizations never see each other's data

### Security Implications

Multi-tenancy is a critical security architecture decision affecting every table, API, cache key, job, report, log, audit entry, file path, and search index:

- **Database isolation**: Row-Level Security policies at the database layer
- **API isolation**: Every API request validated for tenant authorization
- **Cache isolation**: Cache keys include tenant identifier
- **File isolation**: Files stored in tenant-specific paths
- **Audit isolation**: Audit logs tagged with tenant
- **Reporting isolation**: Reports filtered by tenant
- **Backup isolation**: Tenants can be restored independently
- **Administrative isolation**: Organization admins cannot access other organizations

---

## Objective 4: Cross-Platform Operation

**Statement**: The ERP shall provide a consistent user experience across multiple platforms using a shared backend. Supported platforms include Windows Desktop, Android, and Web Browser, with future support for iOS, macOS, and Linux. The backend architecture shall remain identical regardless of the client platform.

### Rationale

Different users prefer different platforms:
- **Office workers** use Windows Desktop for power and productivity
- **Field/warehouse staff** use Android tablets for mobility
- **Executives/remote users** use Web browsers for accessibility
- **Mac/Linux users** require cross-platform support

Developing separate applications for each platform is expensive and creates inconsistencies.

### Solution

The ERP uses a shared backend with platform-specific clients:

**Backend** (Universal):
- Single Node.js/TypeScript backend
- Single PostgreSQL database
- Single API layer
- All business logic runs here
- All platforms consume the same APIs

**Frontend** (Platform-Specific):
- Flutter Desktop for Windows
- Flutter Web for browsers
- Flutter Mobile for Android
- Future: iOS, macOS, Linux

All clients use the same backend, ensuring:
- Consistent business logic across platforms
- Single source of truth for data
- Unified authentication
- Unified authorization
- Consistent audit logging

### Platform Capabilities

| Platform | Use Case | Characteristics |
|----------|----------|-----------------|
| **Windows Desktop** | Office workers, high-volume data entry | Keyboard shortcuts, printing, offline capability (TBD) |
| **Android Mobile** | Field staff, warehouse, logistics | Touch interface, portability, offline capability (TBD) |
| **Web Browser** | Remote access, executives, accessibility | No installation, accessible anywhere, mobile-friendly |
| **iOS** | Future: Mobile sales team, field service | TBD: Roadmap |
| **macOS** | Future: Developer community, executives | TBD: Roadmap |
| **Linux** | Future: Server deployments, advanced users | TBD: Roadmap |

### Benefits

- **Consistent experience**: Users see the same features on all platforms
- **Single backend**: Operations team manages one backend
- **Faster updates**: One backend version serves all platforms
- **Cost efficiency**: Shared development resources across platforms
- **Unified data**: All platforms read/write to the same database
- **Offline support** (future): Mobile apps can work offline with conflict resolution (TBD)

---

## Objective 5: Long-Term Maintainability

**Statement**: The ERP shall be designed so that new modules can be added without changing existing modules, existing modules can evolve independently, business rules remain centralized, and technical debt is minimized through consistent standards.

### Rationale

Enterprise software often lives 10+ years. During that time:
- New requirements emerge
- Business processes change
- Technologies evolve
- Teams change
- Business mergers and acquisitions happen

If the architecture requires changing existing code every time something new is added, the system becomes increasingly fragile and expensive to maintain.

### Solution

The ERP is designed for evolution:

**Module Independence**:
- New modules added without modifying existing modules
- Existing modules updated without affecting other modules
- Modules communicate through published contracts
- Modules evolve within the unified modular-monolith backend; independent deployment is not part of the current architecture

**Business Rule Centralization**:
- Business rules implemented in one place
- Consistent application across the platform
- Rules versioned and documented
- Easy to change business logic without cascading changes

**Architectural Consistency**:
- Consistent naming conventions
- Consistent folder structures
- Consistent API patterns
- Consistent database design patterns
- Consistent error handling
- Consistent logging
- Consistent documentation

**Technical Debt Minimization**:
- Standard practices documented upfront
- Code reviews enforce standards
- Automated checks verify patterns
- Refactoring encouraged within modules
- Old code gradually modernized
- No accumulation of "legacy" code

### Long-Term Sustainability Benefits

- **Add capabilities without rewriting**: New Sales sub-module added alongside existing Sales module
- **Upgrade modules within the unified backend**: Manufacturing changes should preserve defined contracts and avoid unnecessary impact on Sales
- **Maintain code quality**: Consistent standards prevent decay
- **Reduce surprises**: Well-documented decisions avoid rework
- **Support growth**: Architecture scales without fundamental redesign
- **Enable evolution**: Business capabilities evolve without massive refactoring
- **Reduce cost**: Lower maintenance effort as system matures
- **Support succession**: New teams can understand and modify code

### Examples of Evolution

**Example 1: Add Advanced Manufacturing**:
- Existing Manufacturing module handles simple production
- Add Advanced Manufacturing sub-module for job-cost manufacturing
- New module shares common Manufacturing APIs and data
- Original module unaffected

**Example 2: Change Approval Workflow**:
- Approval rules centralized in Approval Service
- All modules (Sales, Purchase, Manufacturing) use same Approval Service
- Change approval rules in one place
- Applies immediately to all modules

**Example 3: Add New Business Module**:
- New module added to the platform
- Uses shared Authentication, Authorization, Audit Services
- Integrates with other modules through published application/service contracts
- No changes to existing modules

---

## Alignment

All five objectives together create a competitive ERP platform:

```
Unified Platform (Objective 1)
    ↓ Needs modular approach
Modular Licensing (Objective 2)
    ↓ Requires data isolation
Multi-Tenant Operation (Objective 3)
    ↓ Enables multiple platforms
Cross-Platform Operation (Objective 4)
    ↓ Only possible with consistent architecture
Long-Term Maintainability (Objective 5)
    ↓ Enables all objectives to succeed
```

---

## Related Documents

- **[Vision Statement](./01-vision.md)** — Overall strategic vision
- **[Target Users & Success Criteria](./03-scope-and-success.md)** — How we measure success
- **[System Architecture](../02-architecture/README.md)** — How objectives are achieved
- **[Architectural Principles](../00-overview/01-architectural-principles.md)** — Rules that support objectives

---

## Summary

The five business objectives drive every architectural decision in the ERP platform. New features, modules, and capabilities should advance one or more of these objectives. Architectural decisions that conflict with these objectives should be reconsidered.

These objectives will remain stable throughout the platform's lifetime. They define what the ERP is and what it is not.
