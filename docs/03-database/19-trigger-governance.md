# 19. Trigger Governance

Document Purpose
----------------
Define governance, usage policy, naming, migration and testing guidance for database triggers.

Scope
-----
This document applies to all PostgreSQL triggers created within the Enterprise ERP platform schemas. It covers:
- When triggers may be used
- Naming conventions (refer to [Naming Conventions](./03-naming-conventions.md))
- Testing and migration practices
- Monitoring and operational considerations

Rationale
---------
Triggers can be powerful for enforcing invariants, maintaining derived data, and maintaining audit events near the data. However, they also introduce hidden behavior that complicates migrations, testing, and observability. This governance document ensures triggers are used intentionally and consistently.

Policy
------
1. Allowed Use Cases
   - Enforcing technical invariants that cannot be reliably enforced at the application layer (e.g., physical integrity repairs, system-generated denormalized values required for indexing).
   - Writing append-only audit_event_log entries for low-latency capture when application-level audit is not available.
   - Synchronous propagation for denormalized read models in exceptional cases (must be approved).

2. Prohibited Use Cases
   - Implementing core business rules or domain logic that should live in the Business Layer. See Principle: Backend Owns Business Logic (docs/00-overview/01-architectural-principles.md).
   - Performing long-running or blocking operations inside triggers (external IO, network calls).
   - Hidden multi-row side-effects that cause cascading updates across modules without explicit review.

3. Naming
   - Follow database trigger naming rules in [Naming Conventions](./03-naming-conventions.md#trigger-naming).
   - Recommended format: `trg_<table>_<when>_<purpose>` e.g., `trg_invoice_after_insert_audit`.

4. Testing and CI
   - Every trigger must include unit tests that exercise BEFORE/AFTER semantics and boundary cases.
   - Migration scripts that add, modify, or remove triggers must include verification steps in CI and a rollback plan.

5. Migrations
   - Use the Expand/Contract (zero-downtime) pattern for trigger changes where possible (see ADR-0007: Zero-Downtime Migration Strategy).
   - For destructive trigger changes (drop/replace), ensure a pre-deployment verification step and a safe rollback plan.

6. Documentation
   - Every trigger must be documented in the module's schema migration notes and included in the module's SQL templates (appendix-templates.md).
   - Describe purpose, expected behavior, and failure modes.

7. Operational Monitoring
   - Monitor trigger-led error rates and latency impact during high-volume operations.
   - Include trigger-related errors in audit/incident procedures.

Implementation Notes
--------------------
- Approval: Triggers for production must be approved by the Architecture Review Board or delegated authority.
- Exceptions: Any exception to this governance must be documented and approved via ADR.

Related Documents
-----------------
- docs/03-database/03-naming-conventions.md
- docs/03-database/appendix-templates.md
- ADR-0007: Zero-Downtime Migration Strategy (docs/10-adr/0007-zero-downtime-migrations.md)

TODO
----
- Add concrete example trigger templates and unit tests to appendix-templates.md (owner: DB team)
- Add migration checklist for trigger changes to docs/03-database/18-lifecycle-governance.md
