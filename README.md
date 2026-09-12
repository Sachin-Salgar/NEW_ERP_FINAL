# NEW_ERP_FINAL

NEW_ERP_FINAL is a modular-monolith ERP platform with a TypeScript/Fastify
backend, PostgreSQL persistence with tenant isolation through RLS, and a
Flutter client.

## Repository structure

- `src/` — backend application, domain, infrastructure, and database migrations
- `frontend/` — Flutter client
- `scripts/` — local development, bootstrap, and verification scripts
- `tests/` — backend unit and PostgreSQL integration tests
- `docs/` — authoritative architecture, security, deployment, and module
  documentation
- `.ai/` — repository-aware AI workflow and navigation guidance

## Local development

Backend dependencies use npm and the committed `package-lock.json`:

```text
npm ci
npm run build
npm run typecheck
```

For the documented full-stack startup sequence, read
[`.ai/workflows/local-deployment.md`](.ai/workflows/local-deployment.md) and
run `scripts/start-local-dev.ps1`. It validates the configured PostgreSQL
connection before starting the backend and Flutter web client.

Frontend setup and commands are documented in
[`frontend/README.md`](frontend/README.md).

## Tests and CI

```text
npm run test:unit
npm run test:integration
npm test
```

GitHub Actions workflows under [`.github/workflows/`](.github/workflows/)
run quality, typecheck, build, security, PostgreSQL integration, and Flutter
web E2E validation as configured.

## Documentation and roadmap

Start with [`docs/README.md`](docs/README.md), then follow the relevant
domain documentation and approved ADRs. The implementation state and next
bounded work item are recorded in
[`docs/00-overview/03-implementation-roadmap.md`](docs/00-overview/03-implementation-roadmap.md).

Deployment architecture and current environment boundaries are documented in
[`docs/07-devops/01-deployment-architecture.md`](docs/07-devops/01-deployment-architecture.md).
