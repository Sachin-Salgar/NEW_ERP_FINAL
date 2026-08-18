#!/usr/bin/env python3
"""Validate the repository-aware AI workflow contract without an LLM."""

from __future__ import annotations

import argparse
from pathlib import Path

REQUIRED_FILES = [
    ".github/copilot-instructions.md",
    ".github/prompts/investigate.prompt.md",
    ".github/prompts/implement-feature.prompt.md",
    ".github/prompts/review-change.prompt.md",
    ".github/prompts/refresh-repository-context.prompt.md",
    ".ai/README.md",
    ".ai/authority.md",
    ".ai/repository-map.md",
    ".ai/workflows/feature-development.md",
    ".ai/workflows/repository-maintenance.md",
    "tools/ai/repository_scanner.py",
    "tools/ai/validate_ai_workflow.py",
    "docs/README.md",
    "docs/00-overview/02-governance.md",
    "docs/10-adr/README.md",
]

REQUIRED_PHRASES = {
    ".github/copilot-instructions.md": ["authoritative source of truth", "STOP and ask", "Do NOT read the entire repository"],
    ".ai/authority.md": ["Authority hierarchy", "Missing decision", "Contradictory documents"],
    ".ai/workflows/feature-development.md": ["Phase 1 — Discover", "Phase 5 — Validate", "Phase 7 — Report"],
    ".ai/workflows/repository-maintenance.md": ["deterministic", "generated inventory", "actual relevant files"],
}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=".")
    args = parser.parse_args()
    root = Path(args.root).resolve()
    failures: list[str] = []

    for relative in REQUIRED_FILES:
        if not (root / relative).is_file():
            failures.append(f"Missing required file: {relative}")

    for relative, phrases in REQUIRED_PHRASES.items():
        path = root / relative
        if not path.is_file():
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        for phrase in phrases:
            if phrase not in text:
                failures.append(f"Missing required phrase in {relative}: {phrase}")

    if failures:
        print("AI workflow validation: FAIL")
        for failure in failures:
            print(f"- {failure}")
        return 1

    print("AI workflow validation: PASS")
    print(f"Validated {len(REQUIRED_FILES)} required repository/workflow files.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
