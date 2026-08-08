# Dependency Injection

<!--
Title: Dependency Injection
Purpose: Canonical migration from Volume 4 — Frontend Architecture
Scope: Dependency injection patterns and DI container guidance for frontend
Audience: Frontend developers, architects
Owner: TBD
Status: Migrated (Draft)
Last Reviewed: 2026-08-07
Related ADRs:
Related Documents: docs/migration-traceability/volume4-to-docs.md
-->

Source: Volume 4 — Chapter 6

6.1 Introduction

Dependency Injection (DI) reduces coupling by supplying objects with their required dependencies rather than allowing them to create dependencies internally.

The Flutter frontend adopts the same architectural philosophy as the backend, promoting modularity, maintainability, and testability.

6.2 Objectives

Dependency Injection aims to:
• Reduce coupling.
• Improve testing.
• Simplify maintenance.
• Enable modular development.
• Improve code reuse.

6.3 Dependency Graph

Illustrative flow:
Screen

↓

Provider

↓

Service

↓

API Client

Each layer depends upon abstractions rather than concrete implementations.

6.4 Registered Services

Typical injectable services include:
• Authentication Service.
• API Client.
• Local Storage.
• Notification Service.
• Navigation Service.
• Logging Service.
• Configuration Service.

These services shall be initialized during application startup.

6.5 Module Registration

Each module shall register only its own dependencies.
Example:
Sales Module

↓

Sales Service

↓

Sales Providers

↓

Sales Routes

This supports module independence and future plugin capabilities.

6.6 Lazy Initialization

Large services shall be initialized only when first required.
Benefits include:
• Faster application startup.
• Reduced memory consumption.
• Improved responsiveness.

6.7 Testability

Dependency Injection enables:
• Mock Services.
• Mock API Clients.
• Mock Storage.
• Mock Authentication.

This simplifies automated testing.

6.8 Best Practices

Developers shall:
• Inject dependencies.
• Avoid global mutable state.
• Prefer interfaces over implementations.
• Keep dependency graphs simple.
Circular dependencies are prohibited.

6.9 Summary

Dependency Injection supports a clean and modular frontend architecture by separating object creation from business functionality, improving maintainability and testing.
