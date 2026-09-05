# ADR-0025: Sales Transaction Branch and Financial-Year Context

**Date**: 2026-09-05  
**Status**: Approved for Sales implementation  
**Scope**: Sales transactional documents and reusable session context

## Problem

The approved organizational-isolation standard requires transactional records
to retain tenant, organization, branch, and financial-year ownership. Existing
sessions already carried the authenticated tenant, organization, branch, and
location context, but did not carry a financial year. Sales quotations
therefore could not persist the complete authorized transaction context.

## Decision

The authenticated session carries an optional `financial_year_id` alongside its
existing organization, branch, and location context.

- The tenant remains established only by authenticated identity.
- Organization and branch remain server-validated working context.
- A context-selection request must name an organization, authorized branch,
  authorized location, and financial year.
- The selected financial year must belong to the active tenant and
  organization, be non-deleted, active, open, and unlocked.
- When a new organization session is created without an explicit financial
  year, the database resolves the organization's single active, open, unlocked
  financial year. The existing unique active-year constraint makes this
  deterministic; no date-based or first-row selection is allowed.
- Sales quotation creation requires the session's branch and financial-year
  context and stores both values immutably. Generic quotation updates cannot
  change either value. Legacy rows whose ownership cannot be established from
  authoritative defaults remain nullable and are excluded from new-context
  operations until an explicit reclassification operation is approved.

## Failure and security behavior

Invalid or unauthorized context selection fails with a forbidden response.
Sales operations without a complete branch/year session context fail closed.
All database access remains tenant-scoped through the existing transaction
context and PostgreSQL RLS. Composite tenant ownership constraints prevent
cross-tenant branch or financial-year references.

## Alternatives rejected

1. Trusting request headers or body identifiers without session validation.
2. Selecting a financial year from the current date.
3. Selecting the first matching year or branch.
4. Adding Sales-specific context storage separate from authenticated sessions.

## Consequences

Sales quotations become fully attributable to the required organizational
hierarchy. Existing quotation rows are backfilled only from explicit
organization defaults; rows without such evidence are preserved and remain a
visible data-remediation residual rather than receiving invented ownership.
Other transactional Sales capabilities must consume the same session context
and must not introduce duplicate context resolution.
