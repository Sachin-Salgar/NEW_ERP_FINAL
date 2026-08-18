# Localization & Internationalization

**Document Purpose:** Define frontend localization, internationalization, regional formatting, and RTL principles.

## 20.1 Introduction

The Enterprise ERP Platform is intended to support organizations operating across different countries, regions, and languages.

The frontend should support localization through a single application architecture without embedding locale-specific business rules throughout UI code.

Localization includes language translation, regional formatting, cultural conventions, and applicable presentation requirements. Authoritative business calculations and legal/business rules remain backend responsibilities.

## 20.2 Objectives

Localization aims to:
- Support multiple languages where required.
- Improve user adoption.
- Support international deployment.
- Respect regional presentation standards.
- Allow additional languages without unnecessary changes to business logic.

## 20.3 Language Support

The application may support:
- Multiple languages.
- Runtime language switching where supported.
- User-specific language selection.
- Organization-level default language.

The exact initial language set is a product/deployment decision and must not be invented by individual modules.

## 20.4 Localized Resources

Localizable content may include:
- Labels.
- Buttons.
- Menus.
- User-facing error messages.
- Help text.
- Notifications.
- Report titles.

User-visible text should not be unnecessarily hard-coded inside widgets when it is expected to be translated.

## 20.5 Regional Formatting

Localization may affect presentation of:
- Dates.
- Times.
- Numbers.
- Currency.
- Percentages.
- Addresses.

Formatting shall follow the applicable user, organization, or business context. Authoritative currency, tax, accounting, and financial calculations must not be replaced by client-side formatting logic.

## 20.6 Time Zones

The application should support appropriate time-zone presentation.

Business timestamps must retain their authoritative backend meaning. The frontend may display timestamps in a user or organization locale/time zone according to the relevant product rules.

## 20.7 Right-to-Left Support

The frontend architecture should accommodate languages requiring Right-to-Left (RTL) presentation where such languages are supported.

RTL behavior may affect:
- Navigation.
- Forms.
- Dialogs.
- Tables.
- Reports.

Components should avoid assumptions that make direction changes unnecessarily difficult.

## 20.8 Translation Management

Translation resources shall remain separate from business logic.

Translation resources should support:
- Version control.
- Validation.
- Addition of future languages.
- Detection of missing translations where tooling supports it.

## 20.9 Accessibility of Localization

Localization and accessibility shall work together. Text expansion, direction changes, locale-specific formats, and translated labels must not break usable layouts or accessible interaction.

Language changes should take effect dynamically where technically supported by the chosen Flutter localization implementation.

## 20.10 Summary

Localization enables the ERP frontend to support different languages and regional presentation requirements while keeping business rules and authoritative calculations within the appropriate backend architecture.

## Cross References

- [Flutter Architecture](./02-flutter-architecture.md)
- [Design System](./10-design-system.md)
- [Accessibility](./21-accessibility.md)
- [Backend API Design Standards](../04-backend/06-api-design-standards.md)
