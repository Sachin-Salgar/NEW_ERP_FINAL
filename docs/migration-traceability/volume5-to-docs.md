# Volume 5 → docs/ Mapping

This file provides the authoritative mapping from Enterprise ERP Architecture Volume 5 (DevOps, Infrastructure & Deployment Architecture) chapters to canonical documents in the repository.

Format: Volume 5 Chapter → Destination File → Status

1) Chapter 1 — DevOps Architecture Overview
↓
docs/07-devops/01-devops-architecture.md
↓
Create

2) Chapter 2 — Infrastructure Architecture
↓
docs/07-devops/02-infrastructure-architecture.md
↓
Create

3) Chapter 3 — Environment Management
↓
docs/07-devops/03-environment-management.md
↓
Create

4) Chapter 4 — Containerization Strategy
↓
docs/07-devops/04-containerization.md
↓
Create

5) Chapters 5+6 — Continuous Integration and Continuous Deployment
↓
docs/07-devops/05-ci-cd-pipeline.md
↓
Create

6) Chapters 7+8 — Monitoring & Centralized Logging
↓
docs/07-devops/08-observability.md
↓
Create (merged into a single observability document)

7) Chapter 9 — Reliability & Fault Tolerance
↓
docs/07-devops/06-reliability-fault-tolerance.md
↓
Create

8) Chapters 10+11 — Backup Strategy and Disaster Recovery
↓
docs/07-devops/09-backup-disaster-recovery.md
↓
Create (merged backup and DR into a single resilience document)

9) Chapter 12 — Security Operations
↓
docs/06-security/03-security-operations.md
↓
Create under canonical security folder; cross-reference from docs/07-devops

10) Chapter 13 — Scalability Strategy
↓
docs/07-devops/07-scalability.md
↓
Create

11) Chapters 14+15 — Maintenance Strategy and Operational Support
↓
docs/07-devops/11-operations-management.md
↓
Create (merged maintenance and operational support into a single operations management document)

12) Chapter 16 — Operational Governance
↓
docs/00-overview/02-governance.md
↓
Cross-reference only (canonical governance remains in overview)

13) Chapter 17 — Documentation Management
↓
docs/00-overview/documentation-management.md
↓
Create under overview as repository-wide documentation standards

14) Chapter 18 — Volume 5 Summary
↓
No dedicated file created
↓
Summary content is folded into docs/07-devops/README.md and the broader repository navigation.

Status Notes:
- Existing docs/07-devops/01-deployment-architecture.md is a legacy Volume 3 deployment reference and is retained for historical compatibility only.
- Security Operations is canonical under docs/06-security and is cross-referenced from the DevOps folder.
- Governance content remains canonical under docs/00-overview/02-governance.md rather than duplicated in DevOps.
- Documentation management is now repository-wide and placed under docs/00-overview.

Next steps:
- Keep the new DevOps documents as the primary Volume 5 migration targets.
- Update docs/07-devops/README.md to reflect the new canonical structure and legacy references.
- Keep docs/07-devops/01-deployment-architecture.md as a compatibility reference with an explicit legacy notice.
- Update docs/00-overview/AI_CONTEXT_INDEX.md after migration completion to include the new canonical documents.
