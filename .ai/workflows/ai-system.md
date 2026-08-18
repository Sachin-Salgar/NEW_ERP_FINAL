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

### A. Maintain deterministic facts

Run the repository scanner after significant repository structure changes or before large cross-module investigations. Generated context is local derived data and must not be committed as authority.

### B. Discover

Classify the request, identify authoritative documents, inspect relevant ADRs, inspect existing implementation/tests, and establish the smallest evidence boundary.

### C. Decide

If the authoritative material establishes the requirement, proceed. If a required decision is missing or contradictory, stop and ask. Architecture changes go through ADR governance.

### D. Plan

Create an evidence-based implementation plan. For clear non-governed feature requests, this is an internal gate and implementation may continue in the same agent run.

### E. Implement

Make the smallest coherent change using established repository patterns and documented architecture.

### F. Validate

Run the strongest applicable automated checks: targeted tests, integration/database/security tests, typecheck, lint/static analysis, build, and broader regression tests where practical.

### G. Review

Check the result against requirements, authoritative documentation, ADRs, module boundaries, tenancy/security rules, and tests.

### H. Report

Report evidence consulted, files changed, validation actually executed, results, and unresolved risks.

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

The AI workflow is operationally complete when a clear feature request can be given in ordinary language and the agent can independently discover the relevant authority, inspect the relevant implementation, implement the change, run applicable validation, and report evidence—while stopping for genuine ambiguity or governed architectural decisions.

The workflow does not promise zero model error. It is designed to make unsupported invention difficult, visible, and testable.
