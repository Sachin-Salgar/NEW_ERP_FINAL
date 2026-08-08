# 5. Data Types & Column Standards

## 6.4 Standard Types
| Purpose | PostgreSQL Type |
| :--- | :--- |
| Identifier | UUID (v7 preferred) |
| Monetary Value | NUMERIC(18, 4) |
| Percentage | NUMERIC(7, 4) |
| Quantity | NUMERIC(18, 4) |
| Timestamp | TIMESTAMPTZ |
| Business Date | DATE |
| Long Text | TEXT |
| Short String | VARCHAR(length) |

## 6.7 Monetary Precision
Never use `FLOAT` or `REAL` for financial data. `NUMERIC` is mandatory for all currency and tax calculations to prevent rounding errors.

## 6.12 JSONB Governance
- **Allowed**: Sparse metadata, user preferences, API payload snapshots, dynamic attributes.
- **Prohibited**: Core transactional facts, fields requiring relational constraints, or primary join keys.
- **Requirement**: Documented JSON schema and indexes for queried keys.

## 6.14 NULL Handling
- Use `NOT NULL` for all mandatory business fields.
- `NULL` represents "unknown", not empty strings or zeros.
