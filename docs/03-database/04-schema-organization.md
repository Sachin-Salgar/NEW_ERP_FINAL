# 4. Schema Organization

## 5.1 Module Isolation
The ERP uses a single database with **schema-per-module** organization where appropriate, or a unified schema with strict naming prefixes to ensure modularity.

## 5.3 Layered Organization
1. **Platform Layer**: Core infrastructure (Tenants, Orgs, Users).
2. **Business Modules**: Domain-specific tables (Sales, Inventory).
3. **Reporting Layer**: Views, materialized views, and summary tables.

## 5.7 Cross-Module Dependencies
- Modules reference other modules via **ID only** at the persistence boundary.
- **Cross-module writes are prohibited.** A module must not directly INSERT, UPDATE, or DELETE data owned by another module.
- **Cross-module reads are permitted when read-only and justified by the use case**, including reporting, analytics, views, materialized views, and approved read models.
- For ordinary business operations, modules should prefer the owning module's published application/service contract when the read requires domain behavior, validation, or ownership rules.
- A direct cross-module read must not be used as a way to bypass the owning module's business rules for a write operation.
- Reporting/read models may combine data from multiple module-owned sources without transferring ownership of that data.
- Service-level APIs remain preferred for cross-module interactions that require business behavior rather than simple read access.

## 5.11 Documentation Requirements
Every table must include:
- `COMMENT ON TABLE ...` describing business purpose.
- `COMMENT ON COLUMN ...` for specific business logic or units.
