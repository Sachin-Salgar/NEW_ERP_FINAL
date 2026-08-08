# Coding Standards (Backend)

Document Purpose: Define coding standards applicable to backend development to ensure consistency, readability, testability and maintainability.

Audience: Backend developers, reviewers, architects

---

## 25. Coding Standards

### 25.1 Introduction

A consistent coding standard is essential for building a large-scale enterprise application. The Enterprise ERP Platform is expected to evolve over many years with multiple developers contributing simultaneously.

Coding standards ensure that every developer writes code in a predictable, readable, and maintainable manner regardless of individual preferences.

These standards apply to all backend source code, shared libraries, utilities, tests, and supporting scripts.

### 25.2 Objectives

The coding standards aim to:

• Improve readability.
• Maintain consistency.
• Reduce defects.
• Simplify code reviews.
• Improve maintainability.
• Accelerate developer onboarding.

### 25.3 General Principles

All backend code shall adhere to the following principles:

• Readability over cleverness.
• Simplicity over complexity.
• Explicit behavior over implicit behavior.
• Composition over inheritance.
• Immutable data where practical.
• Small, focused functions.
• Self-documenting code.

Code should be understandable without requiring extensive comments.

### 25.4 Naming Conventions

Naming shall be descriptive and consistent.

Examples:

Classes
• CustomerService
• SalesInvoiceRepository
• AuthenticationController

Interfaces
• CustomerRepository
• NotificationProvider
• CacheService

Variables
• customerId
• invoiceTotal
• paymentDate

Constants
• MAX_LOGIN_ATTEMPTS
• DEFAULT_PAGE_SIZE

Abbreviations shall be avoided unless they are universally recognized.

### 25.5 File Organization

Every file shall contain one primary responsibility.

Examples:

• One service per file.
• One controller per file.
• One repository per file.
• One domain entity per file.

Large files should be divided into smaller, focused components.

### 25.6 Function Design

Functions shall:

• Perform one responsibility.
• Be concise.
• Validate inputs.
• Return predictable outputs.
• Avoid hidden side effects.

Business workflows shall be composed from smaller reusable functions.

### 25.7 Error Handling

Developers shall:

• Handle expected failures gracefully.
• Throw meaningful exceptions.
• Avoid swallowing exceptions.
• Preserve correlation identifiers.
• Log significant failures.

Unexpected exceptions shall be propagated to the centralized error handling framework.

### 25.8 Documentation

Public classes, interfaces, and complex algorithms shall include documentation explaining:

• Purpose.
• Parameters.
• Return values.
• Business considerations.

Documentation should explain why, not merely what.

### 25.9 Code Reviews

Every production change shall undergo peer review.

Reviews should evaluate:

• Architecture.
• Business correctness.
• Security.
• Performance.
• Readability.
• Test coverage.

No code shall be merged without successful review.

### 25.10 Summary

Consistent coding standards improve software quality, reduce maintenance costs, and ensure that the ERP remains understandable throughout its lifecycle.

---

Cross References

- docs/04-backend/22-coding-standards.md (if backend-specific extension required)
- docs/10-adr/ (for coding-related ADRs)

References

- Volume 3 — Backend Architecture (source)
