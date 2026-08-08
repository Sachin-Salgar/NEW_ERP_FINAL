# 3. Database Naming Conventions

## 4.1 General Rules
- **Lowercase**: `sales_invoice`, not `SalesInvoice`.
- **Snake Case**: Underscores as word separators.
- **Singular Names**: `customer`, not `customers`.
- **Meaningful Business Names**: No `tbl_`, no `data_`.

## 4.5 Column Suffixes
- Identifiers: `_id` (e.g., `customer_id`).
- Timestamps: `_at` (e.g., `created_at`).
- Dates: `_date` (e.g., `invoice_date`).
- Amounts: `_amount` (e.g., `tax_amount`).
- Percentages: `_percentage` (e.g., `discount_percentage`).

## 4.7 Boolean Naming
Use descriptive prefixes: `is_`, `has_`, `can_`.
Example: `is_active`, `has_attachment`.

## 4.8 Temporal Standards (UTC)
- **Instants**: Use `TIMESTAMPTZ` normalized to **UTC**.
- **Business Dates**: Use `DATE` (no time component).
- **Presentation**: Timezone conversion occurs at the API/Client boundary.

## 4.10 Constraint Naming
- PK: `pk_<table>` (e.g., `pk_customer`)
- FK: `fk_<table>_<referenced>` (e.g., `fk_invoice_customer`)
- UK: `uk_<table>_<column>` (e.g., `uk_user_email`)
- CHK: `chk_<table>_<rule>` (e.g., `chk_qty_positive`)
