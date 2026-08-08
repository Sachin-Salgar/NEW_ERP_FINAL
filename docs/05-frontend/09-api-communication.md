# API Communication

<!--
Title: API Communication
Purpose: Canonical migration from Volume 4 — Frontend Architecture
Scope: API client patterns, error handling, contract expectations
Audience: Frontend and backend API teams
Owner: TBD
Status: Migrated (Draft)
Last Reviewed: 2026-08-07
Related ADRs:
Related Documents: docs/04-backend/06-api-design-standards.md, docs/migration-traceability/volume4-to-docs.md
-->

Source: Volume 4 — Chapter 9

9.1 Introduction

The frontend communicates with the backend exclusively through REST APIs.

Direct database access from the frontend is strictly prohibited.

All business operations—including authentication, validation, reporting, approvals, and financial transactions—shall be executed through backend APIs.

9.2 Objectives

The API communication layer aims to:
• Standardize backend communication.
• Improve maintainability.
• Simplify testing.
• Support authentication.
• Handle failures consistently.
• Enable future backend evolution.

9.3 Communication Architecture

Flutter Screen

↓

Provider

↓

Service

↓

API Client

↓

REST API

↓

Backend

Each layer has a clearly defined responsibility.

9.4 API Client

A centralized API client shall manage:
• HTTP Requests.
• Authentication Tokens.
• Headers.
• Timeouts.
• Error Handling.
• Logging.
• Response Parsing.

Business modules shall not create independent HTTP clients.

9.5 Authentication

The API client shall automatically:
• Attach access tokens.
• Refresh expired tokens.
• Handle authentication failures.
• Redirect users to login when necessary.

Token management shall remain transparent to business modules.

9.6 Request Processing

Illustrative workflow:
User Action

↓

Provider

↓

Service

↓

API Client

↓

Backend

↓

Response

↓

Provider Update

↓

UI Refresh

This architecture ensures predictable state updates.

9.7 Error Handling

API failures shall be categorized.
Examples:
• Network Failure.
• Authentication Failure.
• Authorization Failure.
• Validation Error.
• Business Error.
• Server Error.

The frontend shall display meaningful messages without exposing technical details.

9.8 Retry Strategy

Retry behavior shall be limited to transient failures such as:
• Temporary network interruption.
• Gateway timeout.
• Service unavailable.

Business transactions shall not be automatically retried unless explicitly supported by backend idempotency mechanisms.

9.9 Response Caching

The frontend may cache selected API responses.
Examples:
• Organization Settings.
• Lookup Data.
• User Preferences.
• Country Lists.
• Tax Configuration.

Transactional data shall generally be retrieved directly from the backend.

9.10 Summary

A centralized API communication layer provides secure, reliable, and maintainable interaction between the Flutter application and the backend while preserving clear separation of responsibilities.

Cross-reference: docs/04-backend/06-api-design-standards.md for API contract expectations.
