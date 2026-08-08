# 6. Primary Key Strategy

## 7.1 Unified Identifier Standard
Every business table must have a single primary key named `id`.

## 7.3 Data Type: UUID
We standardize on **UUID v7** (see [ADR-0005](../10-adr/0005-uuid-version-standard.md)).
- Sortable (time-ordered).
- Globally unique.
- Secure (hard to guess).

## 7.6 Internal vs Business IDs
- **Internal ID**: `id` (UUID). Used for all relational joins.
- **Business ID**: `code` or `number` (e.g., `customer_code`, `invoice_number`). Used by users.

## 7.9 Immutability
Once assigned, the `id` of a record shall never change. Relationships depend on stable identifiers.

## 7.11 Public Exposure
Expose UUIDs in REST APIs. Internal serial IDs (if any) shall never be exposed to clients.
