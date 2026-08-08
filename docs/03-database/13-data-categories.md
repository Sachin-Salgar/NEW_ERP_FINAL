# 13. Shared, Master & Transaction Data

## 14.1 Shared Platform Data
Global reference data shared across ALL tenants.
- **Tables**: `country`, `currency`, `language`, `timezone`.
- **Characteristics**: No `tenant_id`, read-only for users, managed by platform admins.
- **Caching**: Aggressively cached in application memory.

## 15.1 Master Data
Reusable business entities (Customer, Item, Warehouse).
- **Ownership**: Each entity has one owner module.
- **Deduplication**: Validated via unique constraints (e.g., GST No, Email).
- **Lifecycle**: Active -> Inactive -> Archived.

## 16.1 Transaction Data
Operational activities (Sales, Payments).
- **Structure**: Header-Detail pattern (e.g., `sales_invoice` and `sales_invoice_line`).
- **Immutability**: Transactions become immutable once `Posted`.
- **Growth**: High volume; candidates for partitioning.
