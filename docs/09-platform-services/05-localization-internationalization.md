# Localization & Internationalization

## Purpose

Localization and Internationalization enable the ERP to operate across countries, regions, languages, currencies, time zones, legal jurisdictions, and cultural conventions without requiring country-specific source-code forks.

Internationalization (i18n) provides the platform foundations for global use. Localization (L10n) provides regional adaptations through configuration, metadata, translation packages, and approved regional capabilities.

Frontend-specific implementation remains governed by `docs/05-frontend/20-localization.md`.

## Architectural Position

- Globalization is a platform capability within the modular monolith unless an approved ADR states otherwise.
- Regional behavior must be data/configuration driven where practical.
- Localization does not override authoritative business-domain rules or security policy.
- Country-specific statutory requirements must be explicitly implemented and validated; platform support is not itself a claim of legal/regulatory compliance.

## Internationalization Capabilities

The platform should support:

- Unicode.
- Multiple interface languages.
- Localized metadata where required.
- Multiple currencies.
- Date and time formats.
- Number formatting.
- Locale-aware sorting.
- Time zones.
- Regional measurement systems.
- Appropriate pluralization, collation, and formatting rules where required by supported locales.

## Localization Capabilities

Regional packages may contain:

- Tax configuration and integrations.
- Statutory report definitions.
- Invoice/document formats.
- Address formats.
- Calendars and regional holidays.
- Banking standards/integrations.
- Payroll rules where applicable to the supported HR/payroll architecture.
- Legal numbering schemes.
- Government integrations.

A localization package must not silently claim compliance with a jurisdiction's law or regulation unless the actual implemented behavior has been validated and approved.

## Language Management

The platform may support:

- Language packs.
- Translation repositories.
- Runtime language switching.
- User language preferences.
- Fallback languages.
- Versioned translations.
- Translation coverage tracking.

Translations should be metadata-driven and version-controlled.

## Regional Configuration

Regional settings may include:

- Country.
- State/province/region.
- Currency.
- Time zone.
- Fiscal calendar.
- Tax jurisdiction.
- Decimal precision.
- Measurement system.
- Locale.

Inheritance from tenant/organization configuration must follow the configuration framework's explicit precedence rules.

## Integration

Localization integrates with Finance, HR, Procurement, Inventory, CRM, Workflow, Reporting, Notifications, Document Management, and other business/platform capabilities through their published contracts.

Business modules remain responsible for their domain-specific regional behavior; the platform supplies shared localization primitives and regional configuration mechanisms.

## Monitoring and Governance

The platform may monitor:

- Missing translations.
- Translation coverage.
- Package versions.
- Regional configuration changes.
- Localization errors.

Changes to statutory or legally significant configuration require the governance and approval appropriate to the affected domain.

## Extensibility

Additional languages, locales, regional packages, calendars, formats, and integrations can be added without changing the global architecture. Each addition must follow the platform contracts and applicable security/business-domain requirements.

## Implementation Rules for AI/Copilot

AI-assisted implementation must:

- Reuse the existing localization and configuration mechanisms.
- Never hard-code country-specific behavior when an established configuration/metadata mechanism applies.
- Never invent statutory rules, tax rates, holidays, or legal requirements.
- Never claim regulatory compliance based only on the existence of a localization mechanism.
- STOP and ask when jurisdictional rules, precedence, translation ownership, or compliance requirements are unclear.

## Summary

Localization & Internationalization provide the platform foundation for a globally deployable ERP while keeping regional behavior configurable, auditable, upgrade-friendly, and separate from the core business-domain ownership model.