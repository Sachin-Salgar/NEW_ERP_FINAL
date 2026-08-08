# 18. Lifecycle & Governance

## 24.3 Database Migrations
Migrations are version-controlled SQL scripts managed alongside application code.

## 24.15 Zero-Downtime Pattern
We follow the **Expand/Contract** strategy (see [ADR-0007](../10-adr/0007-zero-downtime-migrations.md)).
1. **Expand**: Add column.
2. **Transition**: App writes to both old/new.
3. **Contract**: Remove old column.

## 26.5 Change Approval Process (CAP)
Schema changes require:
1. **ADR**: For major structural changes.
2. **Schema Review**: Approval from a Database Architect.
3. **Dry-run**: Validation against a production-like staging environment.
4. **Performance Check**: `EXPLAIN ANALYZE` for new indexes or complex queries.

## 26.13 Emergency Fixes
Direct production SQL is prohibited. Emergency fixes must be applied via a "hotfix" migration and documented in the audit log.
