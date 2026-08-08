# 8. Audit & Record Lifecycle

## 9.3 Mandatory Audit Columns
Every business table (unless exempt) must include:
- `created_at`: TIMESTAMPTZ (Defaults to `now()`)
- `created_by`: UUID (References `user.id`)
- `updated_at`: TIMESTAMPTZ
- `updated_by`: UUID
- `version_number`: INTEGER (Initial value 1)

## 9.6 Immutability of Creation Data
`created_at` and `created_by` must never be modified after the initial insert.

## 9.17 Append-Only Event Logs
For high-compliance entities (Finance, Inventory), row-level audit columns are supplemented by an immutable `audit_event_log` table tracking:
- Actor
- Action (Create, Update, Delete)
- Before/After snapshots (JSONB)
- Timestamp
- Correlation ID (Request/Transaction ID)

## 9.18 Operational States
Use a `status` column for business lifecycle transitions (e.g., `Draft`, `Approved`, `Posted`).
