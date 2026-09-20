# Sales Approval and Workflow Integration Specification

**Status:** IMPLEMENTED — CANONICAL WORKFLOW/BPM INTEGRATION FOR SALES RETURN
**Owner:** Workflow platform; Sales remains domain owner

## 1. Purpose and scope

Sales requests workflow approvals for documents or transitions. Workflow owns
definitions, rules, tasks, assignments, approvals, delegation, escalation,
and workflow history. Sales owns the Sales document and applies an authorized
decision.

## 2. Required contract

The canonical platform Workflow/BPM contract provides the implemented bounded integration. Sales Return uses:

- document type `sales_return` and action `APPROVE`;
- tenant, Branch, document ID, and document version context;
- idempotent workflow start through the canonical operation key;
- pending task state and canonical approval decision;
- module callback/application-service handling of APPROVED or REJECTED decisions.

The shared workflow engine owns workflow definitions, tasks, assignments, approval decisions, and workflow audit. Sales remains authoritative for the Sales Return record and applies the resulting decision through its application service.

The current bounded implementation uses a synchronous application callback after the canonical workflow decision is committed. Fully atomic cross-component state changes, asynchronous retries/compensation, delegation, escalation, and richer rule evaluation remain governed future extensions under ADR-0043.

## 3. Sales persistence and security

Sales may store workflow instance/task references and current projection
metadata, but not duplicate Workflow private records. Any Sales projection
requires tenant ID, mandatory branch and financial-year references where
transactional, `version_number`, canonical audit metadata, and RLS/FORCE RLS.

Sales must verify Tenant, Branch where applicable, document ID, document `version_number`, and
permission before applying a decision. Client-provided approval state is never
authoritative.

## 4. API/frontend/tests

Sales lifecycle endpoints remain explicit. Workflow actions are not exposed
through arbitrary PATCH. Candidate permissions must use the established resource/action form, such as
`sales.<resource>.approve` and `sales.<resource>.reject`; exact resource/action
keys require approval and are not registered by this specification.

Flutter displays server-authoritative approval/task state and only authorized
actions. Tests cover stale decisions, replayed callbacks, cross-tenant
callbacks, RLS, rollback, audit, and provider failure.

Sales Return approval is now connected to the canonical Workflow/BPM engine. Sales owns the `REQUESTED`, `INSPECTED`, `APPROVED`, `REJECTED`, `PROCESSED`, `CLOSED`, and `CANCELLED` business states and their invariants; Workflow owns the configurable approval orchestration and decision task. The Sales Return application service applies APPROVED/REJECTED outcomes through an explicit callback. Direct module-local approve/reject endpoints and permissions are removed.

## IMPLEMENTATION STATUS

**IMPLEMENTED — BOUNDED SALES RETURN WORKFLOW INTEGRATION**. The integration is limited to the currently implemented Workflow/BPM foundation described by ADR-0043; future workflow capabilities are not implied.
