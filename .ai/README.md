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

New: Roadmap as implementation-progress authority

- `docs/00-overview/03-implementation-roadmap.md` is the authoritative project-state document for "what has been implemented, validated, and what must be done next." AI sessions MUST consult the roadmap at session start and obey the IMMEDIATE NEXT STEP it contains unless the user explicitly instructs otherwise.
- Do not infer completion from code, commits, or prior AI messages. The roadmap checkpoint is the single source of truth for implementation progress and the active work item.

Session initialization (MANDATORY)

At the beginning of every AI implementation session the agent must perform the following read-only sequence before making changes or running commands that modify the workspace:

1. Run `git status --short --untracked-files=all` and record the working tree status.
2. Identify the current branch and recent commits relevant to the active work.
3. Read `.ai/workflows/feature-development.md` and `.ai/workflows/ai-system.md` to re-establish local workflow rules.
4. Read `docs/00-overview/03-implementation-roadmap.md` and extract the CURRENT IMPLEMENTATION CHECKPOINT (CURRENT SLICE, CURRENT STEP, IMMEDIATE NEXT STEP, validation requirements, blockers).
5. Use `.ai/authority.md` to determine which authoritative documents apply to the IMMEDIATE NEXT STEP and read only those documents.

The agent must not start implementation until it can answer: "What exact roadmap step am I implementing?"

Session checkpoint format

Agents should create an ephemeral session-checkpoint that summarizes:

- CURRENT SLICE:
- CURRENT STEP:
- STATUS:
- AUTHORITATIVE DOCS:
- IMPLEMENTATION TARGET:
- VALIDATION REQUIRED:
- KNOWN BLOCKERS:
- IMMEDIATE NEXT STEP:

This checkpoint is ephemeral (in-memory or session files under `.ai/generated/`) and must not duplicate roadmap state — the roadmap remains authoritative.

## Local validation commands

From the repository root:

```text
python tools/ai/validate_ai_workflow.py
python tools/ai/repository_scanner.py
```

The first command validates the workflow contract. The second refreshes deterministic repository context.
