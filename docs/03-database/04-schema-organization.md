# 4. Schema Organization

## 5.1 Module Isolation
The ERP uses a single database with **schema-per-module** organization where appropriate, or a unified schema with strict naming prefixes to ensure modularity.

## 5.3 Layered Organization
1. **Platform Layer**: Core infrastructure (Tenants, Orgs, Users).
2. **Business Modules**: Domain-specific tables (Sales, Inventory).
3. **Reporting Layer**: Views, materialized views, and summary tables.

## 5.7 Cross-Module Dependencies
- Modules reference other modules via **ID only**.
- Direct joins across modules are permitted for READ operations but discouraged for WRITE logic.
- Service-level APIs are preferred for cross-module interactions.

## 5.11 Documentation Requirements
Every table must include:
- `COMMENT ON TABLE ...` describing business purpose.
- `COMMENT ON COLUMN ...` for specific business logic or units.
