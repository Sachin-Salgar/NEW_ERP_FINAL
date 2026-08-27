# NEW_ERP_FINAL AI Development System

This directory contains repository-aware AI workflow artifacts. It is **not** a second source of truth for ERP architecture.

## Source of truth

The authoritative ERP definition remains under `docs/` according to the governance and decision hierarchy defined by:

- `docs/README.md`
- `docs/00-overview/02-governance.md`
- `docs/10-adr/README.md`

For tenancy, authentication, deployment boundary, and RLS work, the approved decision is `docs/10-adr/0006-identity-based-tenant-context.md`.

AI workflow files in `.ai/` explain **how an AI coding assistant should navigate, reason about, implement, and validate changes in the repository**.

## Core layers

### 1. Authority

- `authority.md` — authority and conflict-resolution rules for AI.

### 2. Repository navigation

- `repository-map.md` — stable navigation map of repository domains.
- `generated/` — optional deterministic scanner output; derived facts only.

### 3. Workflows

- `workflows/feature-development.md` — mandatory feature-development lifecycle.
- `workflows/repository-maintenance.md` — scanner/index maintenance lifecycle.

### 4. Deterministic tooling

- `tools/ai/repository_scanner.py` — inventories repository structure and lightweight documentation metadata without an LLM.
- `tools/ai/validate_ai_workflow.py` — validates that the AI workflow contract and required authority entry points exist.

## Fundamental rules

1. `docs/` is the ERP source of truth.
2. `.ai/` is workflow/navigation, not ERP architecture.
3. `.github/` connects the workflow to GitHub Copilot.
4. The scanner reports facts; it does not decide architecture.
5. AI must discover and use the smallest relevant set of authoritative documents and implementation files for each task.
6. AI must inspect actual source files before relying on generated inventory for implementation decisions.
7. AI must not pretend that it has read the entire repository.
8. When required information is missing or contradictory, AI must stop and ask instead of inventing a decision.
9. A feature is not complete until applicable validation has actually run and passed.
10. Deployment URL/API endpoint is connectivity configuration only; it is not authoritative tenant identity.
11. Tenant context is established from authenticated identity, validated tenant access, and the tenant-scoped session defined by ADR-0006.
12. PostgreSQL RLS remains mandatory for tenant-owned data.

## Implementation-progress authority

`docs/00-overview/03-implementation-roadmap.md` is the authoritative project-state document for what has been implemented, what is being refactored, and what must be done next.

AI sessions MUST consult the roadmap at session start and obey its IMMEDIATE NEXT STEP unless the user explicitly instructs otherwise.

During the identity-based tenant migration, the roadmap is intentionally reconciled as a clean implementation plan: retained foundations are marked COMPLETED, affected legacy tenant-resolution work is marked for REFACTOR, and new migration steps become COMPLETED only after implementation and validation evidence exists.

## Session initialization (MANDATORY)

At the beginning of every AI implementation session the agent must perform the following read-only sequence before making changes:

1. Run `git status --short --untracked-files=all` and record working-tree status.
2. Identify the current branch and recent commits relevant to the active work.
3. Read `.ai/workflows/feature-development.md` and `.ai/workflows/ai-system.md` to re-establish local workflow rules.
4. Read `docs/00-overview/03-implementation-roadmap.md` and extract CURRENT IMPLEMENTATION CHECKPOINT and IMMEDIATE NEXT STEP.
5. Use `.ai/authority.md` to determine which authoritative documents apply to the active step.
6. For tenancy/authentication work, read ADR-0006 and the affected database, backend, security, frontend, and deployment documents before implementation.

The agent must not start implementation until it can answer: "What exact roadmap step am I implementing?"

## Session checkpoint format

Agents should create an ephemeral checkpoint containing:

- CURRENT SLICE:
- CURRENT STEP:
- STATUS:
- AUTHORITATIVE DOCS:
- IMPLEMENTATION TARGET:
- VALIDATION REQUIRED:
- KNOWN BLOCKERS:
- IMMEDIATE NEXT STEP:

This checkpoint is ephemeral and must not duplicate roadmap state.

## Local validation commands

From the repository root:

```text
python tools/ai/validate_ai_workflow.py
python tools/ai/repository_scanner.py
```

The first command validates the workflow contract. The second refreshes deterministic repository context.
