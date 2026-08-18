#!/usr/bin/env python3
"""Validate the repository-aware AI workflow contract without an LLM."""

from __future__ import annotations

import argparse
from pathlib import Path

REQUIRED_FILES = [
    "AGENTS.md",
    ".github/copilot-instructions.md",
    ".github/instructions/ai-workflow.instructions.md",
    ".github/instructions/docs-authority.instructions.md",
    ".github/skills/erp-feature-development/SKILL.md",
    ".github/prompts/investigate.prompt.md",
    ".github/prompts/implement-feature.prompt.md",
    ".github/prompts/review-change.prompt.md",
    ".github/prompts/refresh-repository-context.prompt.md",
    ".github/prompts/architecture-change.prompt.md",
    ".ai/README.md",
    ".ai/authority.md",
    ".ai/repository-map.md",
    ".ai/workflows/ai-system.md",
    ".ai/workflows/feature-development.md",
    ".ai/workflows/repository-maintenance.md",
    "tools/ai/repository_scanner.py",
    "tools/ai/validate_ai_workflow.py",
    "docs/README.md",
    "docs/00-overview/02-governance.md",
    "docs/10-adr/README.md",
]

REQUIRED_PHRASES = {
    "AGENTS.md": ["authoritative source of truth", "STOP and ask", "Completion rule"],
    ".github/copilot-instructions.md": ["automatically supplied", "authoritative source of truth", "STOP and ask", "Do NOT read the entire repository"],
    ".github/instructions/ai-workflow.instructions.md": ["deterministic", "fail closed", "Do not create mechanisms that require the user to manually tell Copilot which AI files to read"],
    ".github/skills/erp-feature-development/SKILL.md": ["authoritative", "Anti-hallucination rules", "validation"],
    ".ai/authority.md": ["Authority hierarchy", "Missing decision", "Contradictory documents"],
    ".ai/workflows/feature-development.md": ["Phase 1 — Discover", "Phase 5 — Validate", "Phase 7 — Report", "Clear feature request"],
    ".ai/workflows/repository-maintenance.md": ["deterministic", "generated inventory", "actual relevant files"],
    "tools/ai/repository_scanner.py": ["does not use an LLM", "not architectural authority", "ai-context.md"],
}


def normalize(text: str) -> str:
    """Normalize text for contract checks without changing repository files."""
    return " ".join(text.casefold().split())


def contains_phrase(text: str, phrase: str) -> bool:
    """Check contract phrases case-insensitively and across whitespace/newlines."""
    return normalize(phrase) in normalize(text)


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
            if not contains_phrase(text, phrase):
                failures.append(f"Missing required phrase in {relative}: {phrase}")

    prompt_dir = root / ".github/prompts"
    for path in sorted(prompt_dir.glob("*.prompt.md")) if prompt_dir.exists() else []:
        text = path.read_text(encoding="utf-8", errors="replace")
        if not contains_phrase(text, "agent: 'agent'"):
            failures.append(f"Prompt file is not configured for agent mode: {path.relative_to(root)}")

    skill = root / ".github/skills/erp-feature-development/SKILL.md"
    if skill.is_file():
        text = skill.read_text(encoding="utf-8", errors="replace")
        if not text.startswith("---\n") or not contains_phrase(text, "name: erp-feature-development") or not contains_phrase(text, "description:"):
            failures.append("ERP feature skill is missing required SKILL.md frontmatter")

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
