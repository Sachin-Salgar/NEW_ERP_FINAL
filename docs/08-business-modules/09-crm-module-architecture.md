# CRM Module Architecture

## 1. Purpose

The CRM module manages relationships and interactions with prospects, customers, contacts, partners, and other business relationships throughout the customer lifecycle.

CRM provides a centralized business context for leads, opportunities, activities, communications, campaigns, customer relationships, service cases, and CRM analytics.

This document consolidates the historical CRM material previously distributed across Chapters 13–15 and 73–81 into one current architectural source of truth.

## 2. Module Boundary

CRM is a logical business module within the ERP modular monolith. It is not an independently deployed service by default.

CRM owns CRM-specific relationship and engagement state. It does not become the system of record for financial accounting, inventory, procurement, project execution, or other domains owned by their respective modules.

Cross-module interaction shall use established application/API/event boundaries. A CRM feature must not directly manipulate another module's internal persistence.

## 3. Core Capabilities

The CRM module may provide:

- Lead management
- Customer and contact management
- Opportunity management
- Activity and communication management
- Campaign management
- CRM-to-Sales quotation integration
- Customer service and case management where this capability is enabled
- CRM analytics and customer intelligence

Organizations may enable only the capabilities applicable to their deployment, subject to the platform's module/capability configuration model.

## 4. Customer Lifecycle

A typical lifecycle is:

```text
Lead
  ↓
Qualification
  ↓
Opportunity
  ↓
Quotation / Sales Process
  ↓
Customer
  ↓
Service / Retention
```

This is an illustrative lifecycle. Actual stages, transitions, approval requirements, and qualification rules are configurable business behavior rather than hard-coded assumptions.

## 5. Lead Management

Lead management supports capture, qualification, assignment, nurturing, conversion, and closure of potential business relationships.

### Lead Sources

Possible sources include:

- Website forms
- Email campaigns
- Telephone calls
- Walk-in inquiries
- Trade shows
- Referrals
- Social media
- Marketing campaigns
- External integrations/API imports

The initial implementation shall support only sources actually established by the product requirements and integration architecture.

### Lead Data

A lead may contain:

- Lead number
- Organization/person information
- Contact information
- Address
- Industry
- Source
- Assigned salesperson/team
- Status
- Priority
- Estimated value
- Custom attributes where supported

### Lead Qualification

Qualification criteria may include budget, authority, need, timeline, business characteristics, purchase readiness, and previous interactions.

Scoring and qualification rules shall be configurable where required. AI-assisted qualification or assignment is a future capability unless explicitly implemented.

### Lead Assignment

Assignment may be manual or rule-based, including territory, branch, product, industry, or sales-team rules where supported.

Assignment history shall remain auditable.

## 6. Customer and Contact Management

CRM may maintain customer/account and contact relationships required for relationship management.

Customer information may include:

- Organization name
- Customer category
- Industry
- Relevant tax/customer identifiers
- Addresses
- Sales territory
- Account manager
- Relationship information

Contacts may contain:

- Name
- Designation
- Department
- Phone/mobile
- Email
- Preferred communication method
- Other approved contact attributes

Contacts and customer organizations are separate concepts and may have their own lifecycle and relationship records.

### Relationships

Configurable relationship types may include:

- Parent/subsidiary
- Distributor
- Dealer
- Partner
- Vendor
- Consultant

The authoritative ownership of vendor, financial, or other domain-specific records remains with the corresponding module.

## 7. Customer Timeline

CRM may provide a consolidated customer timeline containing relevant authorized interactions such as:

- Leads
- Activities
- Communications
- Opportunities
- Quotations
- Sales orders
- Invoices
- Support cases
- Projects
- Payments

The timeline is a presentation/integration view. It does not transfer ownership of those records to CRM.

Records owned by other modules remain authoritative in those modules.

## 8. Opportunity Management

Opportunity management tracks qualified potential sales from creation through won, lost, cancelled, or deferred outcomes.

An opportunity may contain:

- Opportunity number
- Customer/account
- Primary contact
- Salesperson/team
- Opportunity name
- Estimated value
- Probability
- Expected closing date
- Sales stage
- Source
- Competitors
- Priority
- Custom attributes

### Opportunity Stages

Example stages include:

```text
Qualified
  ↓
Needs Analysis
  ↓
Proposal
  ↓
Negotiation
  ↓
Won / Lost
```

Organizations may configure stages and transition rules.

### Forecasting

Forecasting may consider opportunity value, probability, expected closing date, historical performance, and other approved inputs.

Forecast calculations must follow the established reporting/analytics contracts and must not silently alter authoritative sales or financial records.

Closed opportunities shall retain closure information such as outcome, date, reason, and final value where applicable.

## 9. Activity and Communication Management

CRM may record interactions such as:

- Calls
- Emails
- Meetings
- Site visits
- Video conferences
- Tasks
- Follow-ups
- Notes

Activities may be associated with customers, contacts, leads, opportunities, or other authorized business records.

Tasks may support assignment, priority, deadlines, reminders, escalation, and completion tracking where those capabilities are implemented.

Communication history must respect privacy, authorization, retention, and data-access policies.

CRM shall not imply ownership of an external email/SMS/telephony system merely because communication metadata is displayed in the CRM timeline.

## 10. Campaign Management

Campaign management may support planning, audience selection, execution, lead generation, budget tracking, and performance analysis.

Campaign types may include email, SMS, events, product launches, referrals, and other configured marketing activities.

Audience selection criteria may include customer segment, geography, industry, purchase history, product interest, territory, and customer status where the relevant data is available and authorized.

Typical metrics include reach, leads generated, conversion rate, cost per lead, acquisition cost, revenue attribution, and ROI.

Specific communication providers and external marketing platforms are integrations, not assumed implementations.

## 11. Quotation and Proposal Integration

CRM may initiate or participate in quotation/proposal workflows, but the authoritative quotation and sales transaction ownership belongs to the Sales architecture where defined by the repository.

CRM may provide:

- Opportunity-to-quotation context
- Customer requirements
- Proposal history/reference
- Approval status visibility
- Conversion navigation

Pricing, tax, commercial calculation, and Sales Order creation must follow the authoritative Sales/Pricing/Tax boundaries.

Quotation revisions and historical versions shall remain auditable according to the Sales module's document lifecycle.

## 12. Customer Service and Case Management

Where enabled, CRM may provide customer-service context and case management for inquiries, complaints, requests, and service cases.

A case may include:

- Case number
- Customer/contact
- Subject and description
- Priority
- Category
- Assigned agent/team
- Status
- SLA reference where applicable
- Resolution summary

Possible lifecycle:

```text
Created
  ↓
Assigned
  ↓
Investigation
  ↓
Resolution
  ↓
Customer Confirmation
  ↓
Closed
```

SLA targets, business hours, holiday calendars, escalation rules, and pause behavior shall be configurable according to the applicable service architecture.

A customer-service capability must not be treated as evidence that a separate Help Desk product or integration already exists.

## 13. CRM Analytics and Customer Intelligence

CRM analytics provides read-oriented insight into CRM activity and customer relationships.

Possible KPIs include:

- Lead conversion rate
- Opportunity win rate
- Pipeline value
- Average deal size
- Sales-cycle duration
- Customer acquisition cost
- Customer lifetime value
- Retention rate
- Customer satisfaction
- Other organization-defined metrics

Analytics and dashboards shall be read-only with respect to authoritative business records.

Predictive analytics such as churn prediction, lead scoring, opportunity prediction, recommendations, or AI sales assistance are future capabilities unless explicitly implemented.

## 14. Integration Boundaries

CRM may integrate with:

- Sales
- Finance
- Inventory
- Projects
- Workflow/BPM
- Notifications
- Document management
- Reporting/analytics
- Customer-service capabilities
- External communication/marketing systems

Integration shall use established contracts and boundaries.

CRM must not directly modify another module's database tables merely to keep a screen or timeline synchronized.

## 15. Security and Authorization

CRM follows the central platform security architecture.

Authorization is enforced by the backend. Frontend hiding of CRM menus, records, or actions is not a security boundary.

CRM access shall respect:

- Tenant/organization scope
- Branch/organizational scope where applicable
- User permissions
- Role-based access
- Record-level restrictions where required
- Sensitive customer/contact data policies

Customer and communication data shall not be exposed merely because it is available to another CRM screen or integration.

## 16. Tenant and Organization Scope

CRM shall operate within the platform's tenant and organization model.

Organization-specific configuration such as lifecycle stages, lead sources, assignment rules, scoring, and campaign categories shall be represented as configuration/data where the architecture permits rather than hard-coded into module logic.

## 17. Auditability and History

Important CRM state transitions and business actions shall remain auditable where required.

Historical records must not be silently overwritten when business rules require immutable history. Corrections shall use the established correction/versioning mechanism.

Audit logging follows the central platform audit architecture rather than creating a separate incompatible CRM audit framework.

## 18. Events and Integration

CRM may publish or consume business events where asynchronous integration provides a genuine architectural benefit.

Events are not mandatory for every interaction. Synchronous APIs/application services remain appropriate where immediate consistency or request/response behavior is required.

Event contracts must be stable, versioned where necessary, and owned according to the platform integration architecture.

## 19. Performance and Scalability

CRM lists, timelines, activities, opportunities, and analytics shall use appropriate pagination, filtering, indexing, and bounded data retrieval.

The frontend must not load unlimited customer history into memory.

Scaling strategy follows the platform's modular-monolith and DevOps architecture. Independent service deployment is not assumed merely because CRM has clear internal boundaries.

## 20. Reporting

Typical CRM reports include:

- Customer directory
- Contact register
- Lead register
- Lead-source analysis
- Lead conversion
- Opportunity pipeline
- Win/loss analysis
- Forecast
- Activity/follow-up report
- Campaign performance
- Customer-service cases
- CRM executive dashboard

Reports must respect authorization and tenant/organization scope.

## 21. Future Extensions

Potential future capabilities include:

- Advanced marketing automation
- External CRM/marketing integrations
- Predictive lead scoring
- Churn prediction
- AI-assisted sales support
- Advanced customer segmentation
- Additional communication channels

These are architectural extension points, not commitments that the current implementation already provides them.

## 22. AI Implementation Rules

AI-assisted implementation must follow repository source-of-truth documents and established module boundaries.

The AI must:

- Keep CRM as a logical module within the modular monolith unless an explicit architecture decision changes that.
- Reuse established platform services instead of creating duplicate authentication, authorization, notification, audit, workflow, or file-storage systems.
- Keep other modules' authoritative data within their owning boundaries.
- Treat configuration as data where the architecture requires organization-specific behavior.
- Avoid inventing external providers or integrations.
- Avoid inventing regulatory, tax, SLA, retention, or security requirements.
- Preserve historical CRM records where required for auditability.
- STOP and ask when a requirement is ambiguous, contradictory, or materially affects an architectural boundary.

## 23. Summary

CRM provides the ERP's relationship-management capabilities across leads, customers, contacts, opportunities, activities, campaigns, service interactions, and customer intelligence.

It remains a logical business module within the modular monolith, integrates with other domains through established boundaries, and does not take ownership of financial, inventory, project, or other domain-specific authoritative data.
