---
agent: 'agent'
description: Refresh deterministic NEW_ERP_FINAL repository context before large AI tasks
---

# Refresh Repository Context

Use this workflow when repository structure or documentation may have changed, or when generated context is missing/stale.

## Rules

- Run `python tools/ai/validate_ai_workflow.py` first.
- Run `python tools/ai/repository_scanner.py` from the repository root.
- Do not modify ERP source code, architecture documents, or ADRs.
- Generated `.ai/generated/` artifacts are derived navigation data only.
- Do not infer architecture from the generated inventory.

## Return

Report:

1. Validation result.
2. Number of files discovered.
3. Documentation inventory location.
4. Repository inventory location.
5. AI context location.
6. Detected technologies.
7. Any scanner errors or unreadable paths.
8. Any repository structure changes that may require updating `.ai/repository-map.md`.
