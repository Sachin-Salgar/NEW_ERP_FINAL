# NEW_ERP_FINAL AI Development System

This directory contains repository-aware AI workflow artifacts. It is **not** a second source of truth for ERP architecture.

## Source of truth

The authoritative ERP definition remains under `docs/` according to the governance and decision hierarchy defined by:

- `docs/README.md`
- `docs/00-overview/02-governance.md`
- `docs/10-adr/README.md`

AI workflow files in `.ai/` explain **how an AI coding assistant should navigate and work with the repository**.

## Core artifacts

- `authority.md` — authority and conflict-resolution rules for AI.
- `repository-map.md` — navigation map of the repository and documentation domains.
- `workflows/feature-development.md` — mandatory feature-development lifecycle.

## Fundamental rule

AI must discover and use the smallest relevant set of authoritative documents and implementation files for each task. It must not pretend that it has read the entire repository.

When required information is missing or contradictory, AI must stop and ask instead of inventing a decision.
