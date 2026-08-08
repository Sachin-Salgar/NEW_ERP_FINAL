# 7. Referential Integrity

## 8.1 Foreign Key Mandate
All relationships between entities must be enforced via database-level **Foreign Key Constraints**.

## 8.4 Naming Standard
Foreign keys must include the referenced table name: `<referenced_table>_id`.
Example: `organization_id`, `customer_id`.

## 8.7 Cascade Rules
- `ON DELETE RESTRICT`: Default for most master data (e.g., cannot delete a Customer with Invoices).
- `ON DELETE CASCADE`: Permitted only for detail/line items (e.g., deleting an Invoice deletes its Lines).
- `ON DELETE SET NULL`: Use only for optional relationships.

## 8.9 Circular Dependencies
Prohibited. Redesign schema or use a middle-table to break cycles.

## 8.11 Indexing FKs
Every foreign key column should have an index to ensure join performance.
