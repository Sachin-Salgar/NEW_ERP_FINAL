# ADR-0038: Bounded Tax Foundation

- Date: 2026-09-05
- Status: Accepted

## Decision

Tax is an organization-scoped configuration capability. A rule has a code,
name, percentage rate, active state, and effective date range. Resolution is
deterministic: exactly one active rule must cover the requested date; zero or
multiple matches fail. Tax results are calculated by the Tax service and are
snapshotted by Sales transactions.

This decision intentionally defers jurisdictional GST components, exemptions,
compound taxes, tax-inclusive pricing, and tax filing/reporting.
