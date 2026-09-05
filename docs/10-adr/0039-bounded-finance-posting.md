# ADR-0039: Bounded Finance Posting

- Date: 2026-09-05
- Status: Accepted

## Decision

Finance owns the minimal receivable posting record required by Sales. A posting
is scoped to tenant, organization, branch, and financial year and stores document
type, document identity, immutable amount, reference, and an idempotency key.
Invoice issuance creates an `INVOICE` posting; credit-note issuance creates a
`CREDIT_NOTE` adjustment. Repeated requests return the existing posting and never
double-post.

This is not a general ledger, chart of accounts, payment, settlement, tax
ledger, or valuation engine. Those capabilities remain deferred.
