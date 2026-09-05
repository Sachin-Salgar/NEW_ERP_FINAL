# Tax Foundation

The bounded Tax capability owns organization-scoped percentage tax rules with
effective dates and active/inactive state. Resolution requires exactly one
active rule for the requested date. Sales snapshots the resolved rule reference,
rate, taxable amount, and tax amount on invoice finalization.

Jurisdictional GST components, exemptions, compound taxes, and filing workflows
are deferred.
