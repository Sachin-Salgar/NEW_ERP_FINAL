# AI Authority Contract

## Purpose

Define which repository information an AI coding assistant may rely on when understanding or changing NEW_ERP_FINAL.

## Authority hierarchy

Use the repository's governance hierarchy exactly as defined by `docs/00-overview/02-governance.md`:

1. **Software Architecture Document (SAD)** — baseline architectural guidance.
2. **Approved ADRs** — supersede affected SAD decisions within their explicit scope.
3. **Development Standards** — implementation standards that operationalize architecture.
4. **Module Specifications** — module-specific application of the higher-level rules.
5. **Source code and tests** — evidence of current implementation, not architectural authority.
6. **AI inference** — lowest authority and never sufficient to override repository evidence.

## Document status

- `Approved` ADR: authoritative for its stated scope.
- `Proposed` ADR: not an implementation authority.
- `Superseded` ADR: not authoritative; follow its replacement.
- `Deprecated` ADR: not authoritative for new implementation.
- `docs/archive/`: historical/reference material; do not treat as current authority unless a current authoritative document explicitly directs its use.

## Conflict rules

### Architecture vs code

If authoritative documentation conflicts with source code, treat the source code as non-conforming implementation. Do not silently change the documentation to match the code.

### SAD vs ADR

An approved ADR wins only for the decision and scope it explicitly addresses. It does not globally invalidate unrelated SAD requirements.

### Standards vs architecture

Development standards clarify how to implement architecture. They may not silently contradict higher-level architectural decisions.

### Missing decision

If a feature requires a decision that the authoritative documentation does not establish, do not invent it. Report the missing decision and stop at the decision boundary.

### Contradictory documents

If two apparently authoritative documents conflict and the conflict cannot be resolved from an approved ADR or governance rule, stop and report the conflict. Do not select one by preference.

## AI evidence requirements

For every non-trivial implementation task, the AI should be able to state:

- authoritative documents consulted;
- approved ADRs consulted;
- existing implementation inspected;
- tests inspected;
- unresolved ambiguities;
- validation performed after the change.
