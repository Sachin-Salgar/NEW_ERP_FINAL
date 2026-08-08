# 1. Database Vision & Principles

## 1.1 Introduction
The database is the foundation of the Enterprise ERP Platform. Unlike application code, business data must remain accurate and consistent for decades.

## 1.2 Database as the Source of Truth
PostgreSQL is the single source of truth. Discrepancies are resolved in favor of the database.

## 1.3 Data Integrity
Enforced through PKs, FKs, Unique, and Check constraints. Application code shall not bypass these protections.

## 1.4 Scalability (Measurable SLOs)
Target metrics for the database platform:

| Metric | Target (Standard) | Target (Enterprise) |
| :--- | :--- | :--- |
| Max Tenants | 1,000 | 5,000+ |
| Max Rows (Transactional) | 100 Million | 1 Billion+ |
| p95 Query Latency | < 100ms | < 50ms |
| Backup Window | < 4 hours | < 1 hour (streaming) |

## 1.5 Design Principles
- **Business Before Technology**: Model concepts (Invoice), not UI (InvoiceForm).
- **Consistency**: Identical conventions across all modules.
- **Explicit Relationships**: Foreign keys, not free-text IDs.
- **Immutable History**: Corrections through reversal entries, not destructive updates.

## 1.6 Canonical Transaction Table Standard
Every tenant-owned transactional table must include:
- `id`: UUID (ADR-0005)
- `tenant_id`: UUID (For RLS isolation)
- `organization_id`: UUID (Legal entity)
- `branch_id`: UUID (Location)
- `financial_year_id`: UUID (Period)
- `version_number`: Integer (Concurrency)
- Audit columns (`created_at`, `updated_at`, etc.)
