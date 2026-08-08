# Localization & Internationalization

<!--
Title: Localization & Internationalization
Purpose: Canonical migration from Volume 4 — Frontend Architecture
Scope: Language support, regional formatting, translation management and RTL
Audience: Frontend developers and localizaton teams
Owner: TBD
Status: Migrated (Draft)
Last Reviewed: 2026-08-07
Related ADRs:
Related Documents: docs/migration-traceability/volume4-to-docs.md
-->

Source: Volume 4 — Chapter 20

20.1 Introduction

The Enterprise ERP Platform is designed to support organizations operating in different countries, regions, and languages.

The frontend shall provide comprehensive localization capabilities while maintaining a single application codebase.

Localization extends beyond language translation to include regional formatting, cultural conventions, and legal requirements.

20.2 Objectives

Localization aims to:
• Support multiple languages.
• Improve user adoption.
• Enable international deployment.
• Respect regional standards.
• Simplify future language additions.

20.3 Language Support

The architecture shall support:
• Multiple languages.
• Runtime language switching.
• User-specific language selection.
• Organization-wide default language.

Additional languages may be added without modifying application logic.

20.4 Localized Resources

Localizable content includes:
• Labels.
• Buttons.
• Menus.
• Error Messages.
• Help Text.
• Notifications.
• Report Titles.

User-visible text shall never be hard-coded within widgets.

20.5 Regional Formatting

Localization shall support regional formatting for:
• Dates.
• Times.
• Numbers.
• Currency.
• Percentages.
• Addresses.

Formatting shall follow user or organization preferences.

20.6 Time Zones

The application shall support multiple time zones.

Business records shall preserve their original timestamps while displaying localized values to users where appropriate.

20.7 Right-to-Left Support

The frontend architecture shall accommodate languages requiring Right-to-Left (RTL) layouts.

Examples include:
• Arabic.
• Hebrew.

RTL support shall extend to navigation, forms, dialogs, and reports.

20.8 Translation Management

Translation resources shall be maintained independently of business logic.

Translation files shall support:
• Versioning.
• Validation.
• Future language additions.

20.9 Accessibility of Localization

Language switching shall not require application reinstallation.

Changes shall be applied dynamically wherever technically feasible.

20.10 Summary

Comprehensive localization enables the ERP to support international organizations while maintaining a unified application architecture.
