# 9. Soft Delete & Retention

## 10.1 Default Deletion Strategy
Business records are **Soft Deleted** by default to preserve historical integrity.

## 10.3 Implementation
- `is_deleted`: BOOLEAN (Default `FALSE`)
- `deleted_at`: TIMESTAMPTZ
- `deleted_by`: UUID

## 10.5 Visibility & RLS
Application queries must always filter for `is_deleted = FALSE`. This is enforced via Global Scopes in ORM or RLS policies.

## 10.10 Data Retention & Purge
- **Privacy (GDPR)**: Personal data may require physical erasure (Hard Delete) or Anonymization upon request.
- **Statutory Retention**: Financial records must be retained for 7-10 years.
- **Administrative Purge**: Bulk removal of old logs or temporary data via controlled scripts.

## 10.13 Unique Constraints w/ Soft Delete
Use **Partial Indexes** to enforce uniqueness only on active records.
```sql
CREATE UNIQUE INDEX uk_customer_code ON customer (tenant_id, customer_code) 
WHERE is_deleted = FALSE;
```
