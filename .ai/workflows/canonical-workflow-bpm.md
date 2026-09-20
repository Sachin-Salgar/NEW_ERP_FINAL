# Canonical Workflow/BPM Implementation Rules

## Purpose

These rules teach AI coding assistants how NEW_ERP_FINAL uses Workflow/BPM across business modules.

The authoritative architecture remains under `docs/`. This file is an AI operating rule, not a replacement architecture document.

## Non-negotiable architecture

1. **There is one canonical Workflow/BPM engine.**
   - Reuse the shared Workflow/BPM platform capability and its application/domain contracts.
   - Do not create a module-local approval engine, approval matrix engine, workflow persistence model, or duplicate human-task/decision engine.

2. **Modules own business state and invariants.**
   - The business module remains authoritative for its records, lifecycle state, validation, calculations, inventory/accounting effects, and domain invariants.
   - Workflow must not directly modify another module's persistence tables.
   - A workflow decision must return through an explicit module application-service contract/handler.

3. **Workflow owns configurable approval/process orchestration.**
   - Approval routing, workflow definitions, human tasks, approval decisions, configurable approval policy, workflow history, and orchestration belong to the canonical Workflow/BPM capability.
   - Module code must not expose direct approve/reject endpoints when those actions are configurable workflow decisions.
   - Module lifecycle actions that are not approval decisions (for example submit, cancel, inspect, process, close) remain module-owned when the module architecture defines them.

4. **Use explicit integration contracts.**
   - A module that needs workflow starts an instance through the canonical WorkflowService contract.
   - The module registers an approved decision handler for the supported document type/action.
   - The handler invokes the module's normal business-state transition/invariant logic.
   - Never write another module's tables from the workflow repository/service.

5. **Authorization is layered, not duplicated.**
   - Workflow actions require workflow authorization.
   - The module callback must still enforce the domain invariants and any applicable module authorization required by the authoritative contract.
   - Never restore removed module-local approval permissions merely to make workflow callbacks work.

6. **Do not assume that every lifecycle transition is a workflow.**
   - A module state machine is not a second workflow engine.
   - Only configurable approval/process orchestration belongs in Workflow/BPM.
   - Fixed domain invariants and execution transitions stay in the owning module.

7. **Do not remove module behavior without auditing its authoritative documents.**
   - Read the central Workflow/BPM architecture.
   - Read the affected module architecture and any more-specific module documents.
   - Read applicable approved ADRs.
   - Inspect existing routes, permissions, services, repositories, migrations, tests, and downstream dependencies.
   - If authoritative documents conflict, STOP; governance requires the conflict to be surfaced rather than guessed.

## Required implementation sequence for a new module

1. Identify the module's authoritative architecture and document lifecycle.
2. Identify which states/transitions are domain-owned and which decisions are configurable approvals/processes.
3. Reuse the canonical Workflow/BPM contracts.
4. Add only the module-side integration adapter/handler required to apply workflow outcomes.
5. Keep module invariants in the module service/repository.
6. Add workflow integration tests plus module lifecycle/invariant tests.
7. Verify tenant/branch/RLS, authorization, audit, idempotency, optimistic concurrency, and transaction boundaries.
8. Search for and reject duplicate module-local approval endpoints/permissions/engines.
9. Update the roadmap with evidence and validation results.

## Current implementation boundary

The current Workflow/BPM foundation is bounded. Do not claim unimplemented ADR capabilities such as parallel approval levels, dynamic approver resolution, delegation, escalation/SLA timers, configurable condition evaluation, affected-level restart, notification/scheduler integration, or fully atomic cross-component workflow/document transactions unless the repository has actually implemented and validated them.

## Architecture authority

Use this rule together with:

- `docs/08-business-modules/14-workflow-bpm-module-architecture.md`
- `docs/09-platform-services/01-platform-service-architecture.md`
- `docs/10-adr/0043-workflow-bpm-engine.md`
- the affected business module architecture and document-specific specifications
- `.ai/authority.md`

If this file conflicts with `docs/` or an approved ADR, the authoritative documentation wins and the conflict must be surfaced.
