# 10. Concurrency Control

## 11.1 Optimistic Concurrency
The ERP platform uses **Optimistic Concurrency Control** for all mutable records to prevent "lost updates" in multi-user environments.

## 11.4 Implementation: Version Column
Every table includes a `version_number` (Integer).
- **Initial value**: 1
- **Update**: Increment by 1 on every write.

## 11.5 Update Workflow
1. Client fetches record with `version_number = 5`.
2. Client submits update with `version_number = 5`.
3. Database executes: `UPDATE ... SET version_number = 6 WHERE id = ... AND version_number = 5`.
4. If 0 rows affected, a conflict occurred.

## 11.6 Conflict Handling (API)
When a version mismatch is detected, the API returns:
- **Status Code**: `409 Conflict`
- **Payload**: Current state of the record and error message.

## 11.10 Immutable Records
Records in final states (e.g., `Posted` Invoices) shall reject all updates regardless of version number.
