# NEW_ERP_FINAL AI Development System

This directory contains repository-aware AI workflow artifacts. It is **not** a second source of truth for ERP architecture.

## Source of truth

The authoritative ERP definition remains under `docs/` according to the governance and decision hierarchy defined by:

- `docs/README.md`
- `docs/00-overview/02-governance.md`
- `docs/10-adr/README.md`

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

## Local validation commands

From the repository root:

```text
python tools/ai/validate_ai_workflow.py
python tools/ai/repository_scanner.py
```

The first command validates the workflow contract. The second refreshes deterministic repository context.
