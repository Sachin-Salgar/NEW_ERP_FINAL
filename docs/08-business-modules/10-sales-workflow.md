# Sales Approval and Workflow Integration Specification

**Status:** Authorization package — dependency contract required
**Owner:** Workflow platform; Sales remains domain owner

## 1. Purpose and scope

Sales requests workflow approvals for documents or transitions. Workflow owns
definitions, rules, tasks, assignments, approvals, delegation, escalation,
and workflow history. Sales owns the Sales document and applies an authorized
decision.

## 2. Required contract

Workflow must publish a provider-neutral contract containing:

- start/retrieve/cancel workflow instance;
- document type, document ID, tenant, organization, and version;
- approval decision, actor, timestamp, comments, and decision version;
- pending task/approval state;
- idempotency key and correlation ID;
- failure classification and retryability.

Synchronous versus asynchronous behavior, callback/event shape, timeout,
retry, compensation, and whether a workflow decision may transition a Sales
document are **BUSINESS DECISION REQUIRED**.

## 3. Sales persistence and security

Sales may store workflow instance/task references and current projection
metadata, but not duplicate Workflow private records. Any Sales projection
requires tenant/org IDs, version, audit metadata, and RLS/FORCE RLS.

Sales must verify tenant, organization, document ID, document version, and
permission before applying a decision. Client-provided approval state is never
authoritative.

## 4. API/frontend/tests

Sales lifecycle endpoints remain explicit. Workflow actions are not exposed
through arbitrary PATCH. Candidate permissions include
`sales.*.approve`, `sales.*.reject`, and `sales.*.return`; exact keys require
approval.

Flutter displays server-authoritative approval/task state and only authorized
actions. Tests cover stale decisions, replayed callbacks, cross-tenant
callbacks, RLS, rollback, audit, and provider failure.

**DEPENDENCY CONTRACT REQUIRED** and **BUSINESS DECISION REQUIRED**.

## IMPLEMENTATION STATUS

**DEPENDENCY CONTRACT REQUIRED** and **BUSINESS DECISION REQUIRED**.
