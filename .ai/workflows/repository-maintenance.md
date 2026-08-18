# Repository Context Maintenance Workflow

This workflow maintains deterministic repository facts used by AI assistants.

## Principles

- The scanner is deterministic and must not make architectural decisions.
- Generated inventory is navigation/context, never ERP authority.
- `docs/` remains authoritative.
- Generated artifacts may be stale until the scanner is rerun.
- AI must inspect the actual source files before relying on an inventory entry for implementation.

## When to run

Run the scanner:

- after adding/removing a substantial module;
- after major repository restructuring;
- after adding a new technology or build system;
- before investigating a large cross-module change;
- when repository navigation appears stale.

## Command

From the repository root:

```text
python tools/ai/repository_scanner.py
```

The scanner generates:

- `.ai/generated/repository-inventory.md`
- `.ai/generated/documentation-index.md`

These are derived artifacts. They do not replace source documents.

## AI usage

Use the generated inventory to discover candidate areas, then inspect the actual relevant files and authoritative documentation. Never treat the generated index as proof of business behavior or architecture.
