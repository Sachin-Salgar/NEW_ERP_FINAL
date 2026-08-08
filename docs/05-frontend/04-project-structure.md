# Project Structure

<!--
Title: Project Structure
Purpose: Canonical migration from Volume 4 — Frontend Architecture
Scope: Recommended repository and module project layout
Audience: Engineers and maintainers
Owner: TBD
Status: Migrated (Draft)
Last Reviewed: 2026-08-07
Related ADRs:
Related Documents: docs/migration-traceability/volume4-to-docs.md
-->

Source: Volume 4 — Chapter 4

4.1 Introduction

A well-organized project structure is essential for maintaining a large-scale ERP application. Since the Enterprise ERP Platform is expected to contain hundreds of screens, thousands of widgets, and dozens of business modules, a standardized directory structure is mandatory.

The project structure shall promote modularity, maintainability, scalability, and ease of navigation for developers.

4.2 Objectives

The project structure aims to:
• Standardize code organization.
• Improve maintainability.
• Reduce coupling.
• Simplify onboarding.
• Support modular development.
• Enable future expansion.

4.3 Root Directory Structure

The Flutter project shall adopt the following high-level structure:
lib/

├── app/
├── core/
├── shared/
├── modules/
├── services/
├── routing/
├── themes/
├── localization/
├── assets/
└── main.dart

Each directory has a clearly defined responsibility.

4.4 Core Directory

The core directory contains infrastructure shared across the entire application.
Examples include:
• Authentication.
• Dependency Injection.
• Networking.
• Configuration.
• Error Handling.
• Logging.
• Security.
• Storage.

Business-specific code shall not reside within the core directory.

4.5 Shared Directory

The shared directory contains reusable UI components.
Examples include:
• Buttons.
• Dialogs.
• Form Controls.
• Data Tables.
• Charts.
• Loading Indicators.
• Empty State Widgets.
• Search Components.

These components shall remain business-independent.

4.6 Modules Directory

Each ERP module shall reside within its own directory.
Example:
modules/

├── dashboard/
├── sales/
├── purchasing/
├── inventory/
├── finance/
├── hr/
├── payroll/
└── crm/

Each module shall remain self-contained.

4.7 Module Internal Structure

Each module shall follow a standardized structure.
sales/

├── screens/
├── widgets/
├── providers/
├── models/
├── services/
├── routes/
├── validators/
├── assets/
└── tests/

Consistency across modules improves maintainability.

4.8 Benefits

A standardized project structure:
• Improves discoverability.
• Reduces development time.
• Simplifies code reviews.
• Supports large development teams.
• Encourages architectural consistency.

4.9 Summary

The project structure forms the organizational foundation of the Flutter application and ensures that every module follows consistent design principles.
