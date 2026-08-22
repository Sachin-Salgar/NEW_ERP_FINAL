# AI Development System Lifecycle

## Purpose

Provide a repeatable, repository-aware workflow for building NEW_ERP_FINAL with an AI coding assistant while keeping the ERP documentation authoritative and preventing silent invention.

## Layers

```text
docs/
  authoritative ERP definition
        ↓
.ai/
  authority + navigation + workflows + derived context
        ↓
tools/ai/
  deterministic repository facts and workflow validation
        ↓
.github/
  always-on Copilot rules + path rules + task skills + reusable prompts
        ↓
AI coding assistant in Agent mode
        ↓
understand → plan → implement → validate → review → report
```

## Operating cycle

### Session initialization (MANDATORY)

At the start of every AI implementation session the agent must perform the following read-only initialization sequence and record an ephemeral session checkpoint before proceeding to discovery or any code changes:

1. Run `git status --short --untracked-files=all` and note working-tree state.
2. Identify the current branch and recent relevant commits (e.g., last 10 `git log --oneline --decorate -10`).
3. Read `.ai/workflows/feature-development.md` and `.ai/workflows/ai-system.md` to re-load local workflow rules.
4. Read `docs/00-overview/03-implementation-roadmap.md` and extract the CURRENT IMPLEMENTATION CHECKPOINT (CURRENT SLICE, CURRENT STEP, IMMEDIATE NEXT STEP, validation requirements, blockers).
5. Using `.ai/authority.md`, determine which authoritative docs apply to the IMMEDIATE NEXT STEP and read only those documents.

The agent must explicitly answer the question: "What exact roadmap step am I implementing?" before making any change. If the agent cannot answer this, STOP and ask the user.

### A. Maintain deterministic facts

Run the repository scanner after significant repository structure changes or before large cross-module investigations. Generated context is local derived data and must not be committed as authority.

### B. Discover

Classify the request, identify authoritative documents, inspect relevant ADRs, inspect existing implementation/tests, and establish the smallest evidence boundary.

### C. Decide

If the authoritative material establishes the requirement, proceed. If a required decision is missing or contradictory, stop and ask. Architecture changes go through ADR governance.

### D. Plan

Create an evidence-based implementation plan. For clear non-governed feature requests, this is an internal gate and implementation may continue in the same agent run.

Important: The agent must normally implement exactly the IMMEDIATE NEXT STEP recorded in `docs/00-overview/03-implementation-roadmap.md`. Only change to another step if the roadmap is updated to re-sequence work, or the current step is explicitly completed.

### E. Implement

Make the smallest coherent change using established repository patterns and documented architecture.

Rules enforced during implementation:

- One active implementation step: the agent must not silently skip or re-order roadmap steps. Work must follow the IMMEDIATE NEXT STEP.
- Roadmap update requirement: after every meaningful implementation step, update `docs/00-overview/03-implementation-roadmap.md` with step status, files changed, tests run, validation commands and results, evidence, remaining risks, and the new IMMEDIATE NEXT STEP.
- If a step requires a product decision, stop at the decision boundary, record the blocker in the roadmap, and ask the user.

### F. Validate

Run the strongest applicable automated checks: targeted tests, integration/database/security tests, typecheck, lint/static analysis, build, and broader regression tests where practical.

Never claim a validation passed unless the command actually ran and passed. Record validation commands and their outputs in the roadmap update.

### G. Review

Check the result against requirements, authoritative documentation, ADRs, module boundaries, tenancy/security rules, and tests.

If contradictions are found between authority documents, the roadmap, or code, STOP and report them instead of guessing.

### H. Report (MANDATORY ROADMAP UPDATE BEFORE DECLARING COMPLETE)

Report evidence consulted, files changed, validation actually executed, results, and unresolved risks, and then update the roadmap. The roadmap update must occur before the agent states the step is COMPLETE in its session report.

## Anti-hallucination controls

- Authority hierarchy prevents AI inference from overriding repository decisions.
- Repository scanner supplies deterministic navigation facts rather than AI-generated architecture.
- Actual source files must be inspected before implementation decisions.
- Contradictions are surfaced instead of silently resolved.
- Missing requirements cause a stop-and-ask decision boundary.
- The ERP feature skill packages the detailed implementation behavior and is loaded when relevant.
- Always-on Copilot instructions provide the repository contract without requiring the user to mention `.ai`.
- Automated tests and builds provide executable evidence after implementation.
- AI must never claim a validation result that was not actually executed.

## Completion standard

The AI workflow is operationally complete when a clear feature request can be given in ordinary language and the agent can independently discover the relevant authority, inspect the relevant implementation, implement the change, run applicable validation, update the roadmap with evidence, and report results — while stopping for genuine ambiguity or governed architectural decisions.

The workflow does not promise zero model error. It is designed to make unsupported invention difficult, visible, and testable.
