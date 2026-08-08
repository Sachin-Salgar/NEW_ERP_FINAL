# 15. Scalability & Archival

## 20.3 Table Partitioning
High-volume transactional tables (Audit Logs, Ledger, Stock Trans) must use **PostgreSQL Declarative Partitioning**.
- **Strategy**: Range partitioning by `created_at` or List partitioning by `financial_year_id`.
- **Lifecycle**: Automatic creation of future partitions via background jobs.

## 21.3 Data Archival
Relocating inactive data to cold storage/archive tables to keep operational tables small.
- **Criteria**: Closed financial years older than 2 years.
- **Integrity**: Archived records must preserve original IDs and audit trails.
- **Accessibility**: Authorized users can view archives via a "Include Historical" flag in reporting.

## 21.11 Legal Hold
Records under legal dispute or active audit are exempt from archival or purge policies until the hold is lifted.
