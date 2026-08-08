# 14. Performance Optimization

## 17.1 Indexing Strategy
- **Mandatory**: Primary keys, Foreign keys, Tenant IDs.
- **Composite Indexes**: Use for frequently filtered column sets (e.g., `tenant_id, status, created_at`).
- **Partial Indexes**: Optimize for active data: `WHERE is_deleted = FALSE`.
- **Covering Indexes**: Use `INCLUDE` for high-frequency "index-only" scans.

## 18.6 Check Constraints
Enforce business rules in-database:
- `quantity >= 0`
- `discount_percentage BETWEEN 0 AND 100`

## 19.3 Normalization
- **Standard**: Third Normal Form (3NF) for operational tables.
- **Exception**: Controlled denormalization for reporting (Materialized Views) or high-performance search.
- **Requirement**: ADR required for any redundancy in core transactional tables.
