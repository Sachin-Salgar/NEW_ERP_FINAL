# AI workflow implementation rules

Apply these rules when modifying `.ai/**`, `.github/**`, `AGENTS.md`, or `tools/ai/**`.

- The ERP `docs/` hierarchy remains authoritative; never move architectural authority into AI workflow files.
- Keep repository analysis deterministic wherever possible. Do not add an LLM dependency to the scanner or validator.
- Generated context must be reproducible from repository state and must be treated as navigation/context, not authority.
- AI workflows must fail closed on missing required authority, contradictory governance, stale context, or failed validation.
- Prefer small composable tools over a monolithic agent.
- Any new workflow step must define its input, evidence source, output, failure condition, and validation.
- Do not create mechanisms that require the user to manually tell Copilot which AI files to read for normal feature work.
- Keep the default feature workflow autonomous for clear requests: investigate, plan internally, implement, validate, report. Stop only for genuine ambiguity, authority conflicts, or governed architectural decisions.
