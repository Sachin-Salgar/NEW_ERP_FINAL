# ADR-0043: Configurable Branch-Specific Workflow and Approval Engine

**Date**: 2026-09-12  
**Status**: Approved  
**Approval Date**: 2026-09-12  
**Approved By**: Project Owner following architecture review  
**Scope**: Generic configurable workflow and approval capability for supported ERP business documents

## Context

The ERP contains multiple business documents and processes that may require approval before they can proceed to their next business state. Approval requirements must be configurable rather than hard-coded into individual modules, while preserving tenant and branch isolation, authorization, auditability, and deterministic historical behavior.

## Decision

The ERP will provide a generic, configurable, branch-specific Workflow/BPM engine. It can be attached to supported ERP business document types. Individual modules determine which document types expose workflow configuration; the workflow platform remains generic. Workflow configuration is managed by the Global Administrator and is branch-specific.

## Workflow Configuration

Each supported workflow may configure:

- whether approval is required;
- approval rules;
- approval levels;
- approver resolution;
- approval completion policy;
- rejection behavior;
- delegation behavior;
- escalation behavior;
- cancellation behavior.

A workflow may explicitly require approval or allow the underlying module lifecycle to proceed without an approval workflow.

## Rule Model

Workflow rules are configurable rather than hard-coded. The model shall support conditions including document type, branch, department, requester/user, role, amount, currency, supplier, customer, item/category, cost center, project, and applicable document attributes/custom fields. The architecture remains extensible for future rule conditions.

## Approver Resolution

The engine shall support resolution from a specific user, role, department/role combination, dynamically resolved relationship, branch-specific organizational relationship, and other explicitly supported resolver types. Resolution uses workflow configuration and document/request context.

## Approval Execution

Approval levels execute in parallel. When multiple approvers are assigned to a level, completion behavior is configurable, including all assigned approvers or any assigned approver, subject to the supported rule set.

## Rejection

Rejection behavior is configurable per workflow. Supported outcomes may include permanent rejection, return to requester for correction, return to a previous approval level, workflow restart, or document cancellation.

## Modification After Approval

If document changes affect approval conditions, only affected approval levels are restarted. Unaffected levels are not unnecessarily restarted. Affected-level determination follows configured rule conditions and data dependencies.

## Delegation

An approver may delegate approval responsibility to another user. Delegation is controlled and auditable. A delegated approver cannot further delegate the delegated responsibility.

## Escalation

Escalation is configurable per workflow and may include reminders, escalation to another approver, escalation to a manager, escalation to a branch administrator, or subsequent escalation levels. Escalation timing is configurable and uses calendar time; weekends and holidays do not pause or extend escalation timers.

## Cancellation

Cancellation is configurable. The workflow configuration determines which authorized actors may cancel an active workflow, such as requester, current approver, administrator, or another configured role.

## Workflow Versioning

Workflow configurations are versioned. New documents use the newly active configuration version. Existing active workflows continue using the version under which they were created and are not automatically recalculated when a new version is published.

## Configuration Ownership

Workflow configuration is controlled by the Global Administrator. Branch-specific configurations are centrally administered but apply specifically to their configured branch. Ordinary users cannot modify workflow definitions unless a future approved decision expands that authority.

## Branch Scope

Workflow configurations are branch-specific. A workflow configured for one branch does not automatically apply to another. Workflow execution uses the branch associated with the applicable business document and does not cross branch boundaries. Cross-branch workflow behavior requires a future explicit architectural decision.

## Audit Requirements

Significant workflow actions shall be auditable, including creation, submission, assignment, approval, rejection, return for correction, delegation creation/execution, escalation, reminders, cancellation, restart, affected-level restart, and completion. Workflow audit records identify workflow/document context and actor and use the existing ERP audit foundation rather than an independent audit architecture.

## Authorization and Isolation

Workflow execution respects authentication, authorization, tenant isolation, branch isolation, PostgreSQL RLS, and transaction boundaries. Workflow cannot bypass authorization of the underlying business document. Approval authority is validated against effective workflow configuration and actor authorization context.

## Transactional Behavior

Where a business document transition and workflow state transition must be atomic, they occur within the same transaction boundary. The workflow implementation does not introduce an independent transaction model that can leave document and workflow state inconsistent.

## Idempotency and Concurrency

Workflow actions are safe against duplicate requests and concurrent approval attempts. The implementation prevents duplicate approvals/rejections/escalations, conflicting transitions, and approval of invalid workflow states. Persistence follows existing transaction, concurrency, and idempotency patterns.

## Notifications and Asynchronous Processing

Workflow may integrate with the existing Notification and Scheduler platform services. This ADR does not select a new provider. Workflow notifications, reminders, and escalation jobs use approved platform contracts where applicable. New provider or operational behavior requires its own approved decision if not already covered.

## Alternatives Considered

### Fixed approval hierarchy

Rejected because it cannot adequately support different organizational approval policies.

### Hard-coded approval logic in each ERP module

Rejected because it duplicates workflow behavior and makes policy changes require code changes.

### Global workflow configuration

Rejected because approval policy must be capable of differing between branches.

### Recalculate existing workflows after configuration changes

Rejected because historical approval processes must remain deterministic and continue using their original policy version.

### Sequential approval only

Rejected because the workflow platform must support parallel approval.

## Consequences

Positive consequences include reusable approval behavior, configurable business policies, branch-specific policies, deterministic history, first-class delegation/escalation, auditable actions, configurable completion policies, and affected-level-only restart.

Negative consequences include administrative configuration complexity, rule evaluation complexity, versioning lifecycle complexity, dependency on organizational/role data, concurrency requirements, and careful authorization/audit handling for delegation and escalation.

## Explicit Non-Goals

This ADR does not define workflow administration UI, a specific workflow vendor/provider, a specific notification provider, a specific scheduler provider, cross-branch workflows, cross-tenant workflows, arbitrary executable code inside workflow rules, an external BPM engine, accounting-specific approval rules, module-specific document lifecycle rules, module-specific approval thresholds, or a universal list of ERP documents requiring approval.

Individual modules must define their document-specific workflow configuration and business rules.

## Acceptance Criteria

1. A supported document type can be configured with approval required or not required.
2. Workflow configuration is branch-specific.
3. Workflow rules evaluate approved configurable conditions.
4. Approvers can be resolved using supported user, role, department, and dynamic mechanisms.
5. Approval levels execute in parallel.
6. Approval-level completion behavior is configurable.
7. Rejection behavior is configurable.
8. Modification can restart only affected approval levels.
9. Delegation is supported and cannot be recursively delegated.
10. Escalation is configurable per workflow.
11. Escalation uses calendar time and is not paused by holidays/weekends.
12. Cancellation behavior is configurable.
13. Workflow configurations are versioned.
14. Existing workflows retain their original configuration version.
15. New workflows use the currently active configuration version.
16. Workflow actions are audited.
17. Authorization is enforced for workflow actions.
18. Tenant and branch isolation are preserved.
19. PostgreSQL RLS remains effective.
20. Concurrent/duplicate workflow actions cannot produce invalid state transitions.
21. Workflow state transitions preserve required ERP transaction boundaries.
22. No workflow operation bypasses authorization of the underlying business document.

## Implementation Guidance

This ADR authorizes implementation of a generic Workflow/BPM foundation but does not authorize implementation of every possible ERP workflow simultaneously. Implementation shall proceed as bounded vertical slices, beginning with the smallest reusable workflow configuration and execution capability whose business-document integration is explicitly specified by the roadmap/module contract. Module-specific workflow behavior requires authoritative module business rules and document lifecycle definitions.

## Decision Status

**Approved**
