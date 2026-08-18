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
  Copilot instructions and reusable prompts
        ↓
AI coding assistant
        ↓
plan → implement → validate → review → report
```

## Operating cycle

### A. Refresh facts when needed

Run the deterministic scanner after significant repository structure changes or before large cross-module investigations.

### B. Investigate

Classify the request, identify authoritative documents, inspect relevant ADRs, inspect existing implementation/tests, and establish the smallest evidence boundary.

### C. Decide

If the authoritative material establishes the requirement, proceed. If a required decision is missing or contradictory, stop and ask. Architecture changes go through ADR governance.

### D. Plan

Produce an evidence-based implementation plan before production code changes for non-trivial work.

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
- Automated tests and builds provide executable evidence after implementation.
- AI must never claim a validation result that was not actually executed.
