# ADR-0032: Sales Discount Minimum Policy

Sales owns reusable discount rules until Workflow/Pricing modules exist. Rules
are organization-scoped, percentage-based, non-stacking, effective-dated, and
must be explicitly published. No automatic tax or accounting effect is made;
documents consume a server-resolved rule snapshot in a later integration.
