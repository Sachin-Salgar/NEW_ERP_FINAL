# ADR-0033: Sales Reporting Minimum Policy

**Date:** 2026-09-05  
**Status:** Approved for bounded Sales reporting implementation

## Decision

Sales exposes a read-only document summary report covering Sales Invoices,
Sales Returns, and Sales Credit Notes. Results are limited to the authenticated
tenant, organization, branch, and financial-year context, require the Sales
reporting permission, and use deterministic document-number and ID ordering with
server pagination.

The report exposes only Sales-owned document facts. Finance, Tax, Inventory,
Workflow, and Reporting/BI measures remain dependency boundaries and are not
calculated by this report.

## Consequences

The initial report is safe to expose before a separate Reporting/BI module is
available. Additional dimensions, measures, exports, freshness guarantees, and
cross-module metrics require a future approved contract.
