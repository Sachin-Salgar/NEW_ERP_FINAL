# Volume 6 to Docs Mapping

This document records Phase 3 repository mapping decisions for Volume 6: ERP Business Modules & Functional Architecture.

## Executive Summary

- Volume 6 is mapped to canonical business module architecture under `docs/08-business-modules`, enterprise platform services under `docs/09-platform-services`, master data governance under `docs/03-database`, and enterprise security architecture under `docs/06-security`.
- Existing repository placeholders in `docs/08-business-modules` and `docs/09-platform-services` are sufficient to host new canonical documents; no existing major docs need to be replaced.
- Volume 7 content is treated as a conflict source; overlapping platform service topics are resolved in favor of existing `docs/09-platform-services` and `docs/03-database`/`docs/06-security` canonical homes.
- No Volume 6 chapter is left without a canonical destination.

## Canonical Ownership Matrix

| Domain | Canonical Folder | Primary Owner | Cross-Reference Consumers |
|---|---|---|---|
| Business Modules Architecture | `docs/08-business-modules` | Business Modules / Architecture | Backend, Database, Security, Platform Services |
| Platform Services Architecture | `docs/09-platform-services` | Platform Services | Business Modules, Backend, Security, Operations |
| Master Data & Reference Data | `docs/03-database` | Database | Business Modules, Platform Services, Security |
| Enterprise Security Architecture | `docs/06-security` | Security | Backend, Platform Services, Business Modules |
| Documentation / Governance | `docs/00-overview` | Architecture / Governance | All domains |

## Final File Decision Matrix

| Proposed File | Decision | Reason |
|---|---|---|
| `docs/08-business-modules/01-business-modules-architecture.md` | Create | Business module architecture, classification, dependency model, and module boundary rules. |
| `docs/08-business-modules/02-core-enterprise-modules.md` | Create | Core enterprise modules for organization, identity, RBAC, and foundational platform modules. |
| `docs/09-platform-services/01-platform-service-architecture.md` | Create | Platform services architecture for notification, document management, workflow engine, and common platform modules. |
| `docs/08-business-modules/03-sales-module-architecture.md` | Create | Sales and customer-facing commerce module architecture. |
| `docs/08-business-modules/04-procurement-module-architecture.md` | Create | Procurement and vendor management module architecture. |
| `docs/08-business-modules/05-inventory-module-architecture.md` | Create | Inventory and warehouse management module architecture. |
| `docs/08-business-modules/06-manufacturing-module-architecture.md` | Create | Manufacturing execution and planning module architecture. |
| `docs/08-business-modules/07-finance-module-architecture.md` | Create | Financial management and accounting module architecture. |
| `docs/08-business-modules/08-hr-module-architecture.md` | Create | Human resources and payroll module architecture. |
| `docs/08-business-modules/09-crm-module-architecture.md` | Create | Customer relationship management module architecture. |
| `docs/08-business-modules/10-project-management-module-architecture.md` | Create | Project management module architecture. |
| `docs/08-business-modules/11-quality-management-module-architecture.md` | Create | Quality management and supplier/customer quality module architecture. |
| `docs/08-business-modules/12-asset-maintenance-module-architecture.md` | Create | Asset and maintenance management module architecture. |
| `docs/08-business-modules/13-bi-analytics-module-architecture.md` | Create | Business intelligence, reporting, analytics, and metadata governance architecture. |
| `docs/08-business-modules/14-workflow-bpm-module-architecture.md` | Create | Workflow, BPM, approvals, SLA, and process automation architecture. |
| `docs/09-platform-services/02-enterprise-integration-platform.md` | Create | Enterprise integration platform architecture for APIs, messaging, connectors, and EDI. |
| `docs/09-platform-services/03-ai-platform-architecture.md` | Create | Artificial intelligence platform architecture and ML lifecycle management. |
| `docs/06-security/04-enterprise-security-architecture.md` | Create | Enterprise security platform architecture and operational security controls. |
| `docs/03-database/20-master-data-management.md` | Create | Master data, reference data, metadata, and data governance architecture. |
| `docs/09-platform-services/04-enterprise-configuration-framework.md` | DEPRECATED (placeholder) | Deprecated — Volume 6 has no dedicated enterprise-configuration chapter; configuration content is preserved in module and integration docs (see audit). |
| `docs/09-platform-services/05-localization-internationalization.md` | DEPRECATED (placeholder) | Deprecated — Volume 6 localization mentions are preserved in frontend and module docs; frontend localization is canonical in `docs/05-frontend/20-localization.md`. |

## Migration Order

The migration order is defined by dependency and ownership boundaries, not by source volume chapter order.

1. `docs/08-business-modules/01-business-modules-architecture.md`
2. `docs/08-business-modules/02-core-enterprise-modules.md`
3. `docs/09-platform-services/01-platform-service-architecture.md`
4. `docs/08-business-modules/09-crm-module-architecture.md`
5. `docs/08-business-modules/03-sales-module-architecture.md`
6. `docs/08-business-modules/04-procurement-module-architecture.md`
7. `docs/08-business-modules/05-inventory-module-architecture.md`
8. `docs/08-business-modules/06-manufacturing-module-architecture.md`
9. `docs/08-business-modules/07-finance-module-architecture.md`
10. `docs/08-business-modules/08-hr-module-architecture.md`
11. `docs/08-business-modules/10-project-management-module-architecture.md`
12. `docs/08-business-modules/11-quality-management-module-architecture.md`
13. `docs/08-business-modules/12-asset-maintenance-module-architecture.md`
14. `docs/08-business-modules/13-bi-analytics-module-architecture.md`
15. `docs/08-business-modules/14-workflow-bpm-module-architecture.md`
16. `docs/03-database/20-master-data-management.md`
17. `docs/09-platform-services/02-enterprise-integration-platform.md`
18. `docs/09-platform-services/03-ai-platform-architecture.md`
19. `docs/06-security/04-enterprise-security-architecture.md`
20. `docs/09-platform-services/04-enterprise-configuration-framework.md`
21. `docs/09-platform-services/05-localization-internationalization.md`

## Conflict Resolution Matrix

| Topic | Canonical Owner | Volume 6 Decision | Volume 7 / Existing Overlap |
|---|---|---|---|
| Notification & Communication | `docs/09-platform-services` | Create under platform service architecture | `docs/04-backend/15-notification-framework.md` remains implementation reference |
| Document Management / File Storage | `docs/09-platform-services` | Create platform service architecture; cross-reference backend file storage | `docs/04-backend/14-file-storage-architecture.md` remains implementation reference; Volume 7 document management is conflict source |
| Workflow Engine / BPM | `docs/09-platform-services` + `docs/08-business-modules` | Create workflow service architecture and workflow/BPM functional architecture | `docs/04-backend/08-service-layer-design.md` remains implementation guidance |
| Enterprise Integration | `docs/09-platform-services` | Create EIP canonical doc | Existing backend API design patterns remain implementation guidance; Volume 7 EDI/MFT and file exchange overlap are conflict sources |
| Master Data / Reference Data | `docs/03-database` | Create master data canonical doc | Volume 7 MDM/Reference Data are conflict sources; database is canonical owner |
| Enterprise Configuration | `docs/09-platform-services` | Create configuration service architecture | Architecture principles remain in `docs/00-overview/01-architectural-principles.md` |
| Localization / Internationalization | `docs/09-platform-services` | Create localization architecture | Volume 7 localization is a conflict source; keep platform service ownership |
| Enterprise Security Architecture | `docs/06-security` | Create security architecture doc; cross-reference backend auth and security operations | Volume 7 enterprise security is conflict source; canonical security remains in `docs/06-security` |
| Business Modules Functional Architecture | `docs/08-business-modules` | Create modular domain docs for sales, procurement, inventory, manufacturing, finance, HR, CRM, project, quality, asset, BI, workflow | Existing `docs/08-business-modules/README.md` remains the overview anchor |

## AI Context Update Plan

- After Phase 4 migration, update `docs/00-overview/AI_CONTEXT_INDEX.md` to include new canonical Volume 6 documents in:
  - `docs/08-business-modules/`
  - `docs/09-platform-services/`
  - `docs/03-database/20-master-data-management.md`
  - `docs/06-security/04-enterprise-security-architecture.md`
- Add search keywords for: business modules, sales architecture, procurement architecture, inventory architecture, manufacturing architecture, finance architecture, HR architecture, CRM architecture, project management architecture, quality management architecture, asset management architecture, BI architecture, workflow BPM, enterprise integration platform, AI platform, enterprise security, master data management, enterprise configuration, localization.
- Keep AI context updates to one final pass after canonical document creation to avoid drift.

## Chapter Mapping Table

| Chapter | Title | Canonical Destination | Action | Notes |
|---|---|---|---|---|
| 1 | Introduction to Business Modules | `docs/08-business-modules/01-business-modules-architecture.md` | Create |  |
| 2 | Module Classification | `docs/08-business-modules/01-business-modules-architecture.md` | Extend |  |
| 3 | Module Dependency Model | `docs/08-business-modules/01-business-modules-architecture.md` | Extend |  |
| 4 | Organization Management Module | `docs/08-business-modules/02-core-enterprise-modules.md` | Create |  |
| 5 | Branch Management Module | `docs/08-business-modules/02-core-enterprise-modules.md` | Extend |  |
| 6 | User & Identity Management Module | `docs/08-business-modules/02-core-enterprise-modules.md` | Extend |  |
| 7 | Role Management Module | `docs/08-business-modules/02-core-enterprise-modules.md` | Extend |  |
| 8 | Permission Management Module | `docs/08-business-modules/02-core-enterprise-modules.md` | Extend |  |
| 9 | Role-Based Access Control (RBAC) | `docs/08-business-modules/02-core-enterprise-modules.md` | Extend |  |
| 10 | Notification Management Module | `docs/09-platform-services/01-platform-service-architecture.md` | Create | Platform service architecture content; centralized service ownership in platform services. |
| 11 | Document Management Module | `docs/09-platform-services/01-platform-service-architecture.md` | Extend | Platform service architecture content; centralized service ownership in platform services. |
| 12 | Workflow Engine Module | `docs/09-platform-services/01-platform-service-architecture.md` | Extend | Platform service architecture content; centralized service ownership in platform services. |
| 13 | CRM Module Overview | `docs/08-business-modules/09-crm-module-architecture.md` | Create |  |
| 14 | Lead Management | `docs/08-business-modules/09-crm-module-architecture.md` | Extend |  |
| 15 | Opportunity Management | `docs/08-business-modules/09-crm-module-architecture.md` | Extend |  |
| 16 | Sales Module Overview | `docs/08-business-modules/03-sales-module-architecture.md` | Create |  |
| 17 | Quotation Management | `docs/08-business-modules/03-sales-module-architecture.md` | Extend |  |
| 18 | Sales Order Management | `docs/08-business-modules/03-sales-module-architecture.md` | Extend |  |
| 19 | Delivery & Shipment Management | `docs/08-business-modules/03-sales-module-architecture.md` | Extend |  |
| 20 | Sales Invoice Management | `docs/08-business-modules/03-sales-module-architecture.md` | Extend |  |
| 21 | Sales Returns & Credit Notes | `docs/08-business-modules/03-sales-module-architecture.md` | Extend |  |
| 22 | Procurement Module Overview | `docs/08-business-modules/04-procurement-module-architecture.md` | Create |  |
| 23 | Vendor Management | `docs/08-business-modules/04-procurement-module-architecture.md` | Extend |  |
| 24 | Purchase Requisition Management | `docs/08-business-modules/04-procurement-module-architecture.md` | Extend |  |
| 25 | Request for Quotation (RFQ) Management | `docs/08-business-modules/04-procurement-module-architecture.md` | Extend |  |
| 26 | Purchase Order Management | `docs/08-business-modules/04-procurement-module-architecture.md` | Extend |  |
| 27 | Goods Receipt Management (GRN) | `docs/08-business-modules/04-procurement-module-architecture.md` | Extend |  |
| 28 | Vendor Invoice Management | `docs/08-business-modules/04-procurement-module-architecture.md` | Extend |  |
| 29 | Vendor Returns Management | `docs/08-business-modules/04-procurement-module-architecture.md` | Extend |  |
| 30 | Procurement Analytics & Vendor Performance | `docs/08-business-modules/04-procurement-module-architecture.md` | Extend |  |
| 31 | Inventory Management Overview | `docs/08-business-modules/05-inventory-module-architecture.md` | Create |  |
| 32 | Item Master Management | `docs/08-business-modules/05-inventory-module-architecture.md` | Extend |  |
| 33 | Warehouse Management | `docs/08-business-modules/05-inventory-module-architecture.md` | Extend |  |
| 34 | Inventory Transactions Management | `docs/08-business-modules/05-inventory-module-architecture.md` | Extend |  |
| 35 | Batch & Serial Number Management | `docs/08-business-modules/05-inventory-module-architecture.md` | Extend |  |
| 36 | Inventory Valuation & Costing | `docs/08-business-modules/05-inventory-module-architecture.md` | Extend |  |
| 37 | Inventory Transfers Management | `docs/08-business-modules/05-inventory-module-architecture.md` | Extend |  |
| 38 | Inventory Reservation Management | `docs/08-business-modules/05-inventory-module-architecture.md` | Extend |  |
| 39 | Physical Inventory & Cycle Counting | `docs/08-business-modules/05-inventory-module-architecture.md` | Extend |  |
| 40 | Manufacturing Module Overview | `docs/08-business-modules/06-manufacturing-module-architecture.md` | Create |  |
| 41 | Bill of Materials (BOM) Management | `docs/08-business-modules/06-manufacturing-module-architecture.md` | Extend |  |
| 42 | Material Requirements Planning (MRP) | `docs/08-business-modules/06-manufacturing-module-architecture.md` | Extend |  |
| 43 | Production Planning & Scheduling | `docs/08-business-modules/06-manufacturing-module-architecture.md` | Extend |  |
| 44 | Production Order Management | `docs/08-business-modules/06-manufacturing-module-architecture.md` | Extend |  |
| 45 | Work Centers & Routing Management | `docs/08-business-modules/06-manufacturing-module-architecture.md` | Extend |  |
| 46 | Shop Floor Control (SFC) | `docs/08-business-modules/06-manufacturing-module-architecture.md` | Extend |  |
| 47 | Manufacturing Costing | `docs/08-business-modules/06-manufacturing-module-architecture.md` | Extend |  |
| 48 | Manufacturing Analytics & Performance Management | `docs/08-business-modules/06-manufacturing-module-architecture.md` | Extend |  |
| 49 | Finance Module Overview | `docs/08-business-modules/07-finance-module-architecture.md` | Create |  |
| 50 | Chart of Accounts (COA) | `docs/08-business-modules/07-finance-module-architecture.md` | Extend |  |
| 51 | General Ledger (GL) | `docs/08-business-modules/07-finance-module-architecture.md` | Extend |  |
| 52 | Accounts Receivable (AR) | `docs/08-business-modules/07-finance-module-architecture.md` | Extend |  |
| 53 | Accounts Payable (AP) | `docs/08-business-modules/07-finance-module-architecture.md` | Extend |  |
| 54 | Banking & Cash Management | `docs/08-business-modules/07-finance-module-architecture.md` | Extend |  |
| 55 | Budgeting & Forecasting | `docs/08-business-modules/07-finance-module-architecture.md` | Extend |  |
| 56 | Cost Centers & Profit Centers | `docs/08-business-modules/07-finance-module-architecture.md` | Extend |  |
| 57 | Financial Period & Year-End Closing | `docs/08-business-modules/07-finance-module-architecture.md` | Extend |  |
| 58 | Financial Reporting | `docs/08-business-modules/07-finance-module-architecture.md` | Extend |  |
| 59 | Tax Management | `docs/08-business-modules/07-finance-module-architecture.md` | Extend |  |
| 60 | Financial Analytics & Business Intelligence | `docs/08-business-modules/07-finance-module-architecture.md` | Extend |  |
| 61 | Human Resource Management (HRM) Module Overview | `docs/08-business-modules/08-hr-module-architecture.md` | Create |  |
| 62 | Employee Master Management | `docs/08-business-modules/08-hr-module-architecture.md` | Extend |  |
| 63 | Organizational Structure Management | `docs/08-business-modules/08-hr-module-architecture.md` | Extend |  |
| 64 | Recruitment & Applicant Tracking System (ATS) | `docs/08-business-modules/08-hr-module-architecture.md` | Extend |  |
| 65 | Attendance & Time Management | `docs/08-business-modules/08-hr-module-architecture.md` | Extend |  |
| 66 | Leave Management | `docs/08-business-modules/08-hr-module-architecture.md` | Extend |  |
| 67 | Payroll Management | `docs/08-business-modules/08-hr-module-architecture.md` | Extend |  |
| 68 | Performance Management | `docs/08-business-modules/08-hr-module-architecture.md` | Extend |  |
| 69 | Learning & Training Management | `docs/08-business-modules/08-hr-module-architecture.md` | Extend |  |
| 70 | Employee Self-Service (ESS) | `docs/08-business-modules/08-hr-module-architecture.md` | Extend |  |
| 71 | HR Analytics & Workforce Planning | `docs/08-business-modules/08-hr-module-architecture.md` | Extend |  |
| 72 | HR Compliance & Employee Relations | `docs/08-business-modules/08-hr-module-architecture.md` | Extend |  |
| 73 | Customer Relationship Management (CRM) Module Overview | `docs/08-business-modules/09-crm-module-architecture.md` | Extend | Second CRM section; merge into the canonical CRM module architecture document. |
| 74 | Lead Management | `docs/08-business-modules/09-crm-module-architecture.md` | Extend | Second CRM section; merge into the canonical CRM module architecture document. |
| 75 | Customer & Contact Management | `docs/08-business-modules/09-crm-module-architecture.md` | Extend | Second CRM section; merge into the canonical CRM module architecture document. |
| 76 | Opportunity Management | `docs/08-business-modules/09-crm-module-architecture.md` | Extend | Second CRM section; merge into the canonical CRM module architecture document. |
| 77 | Activity & Communication Management | `docs/08-business-modules/09-crm-module-architecture.md` | Extend | Second CRM section; merge into the canonical CRM module architecture document. |
| 78 | Campaign Management | `docs/08-business-modules/09-crm-module-architecture.md` | Extend | Second CRM section; merge into the canonical CRM module architecture document. |
| 79 | Quotation & Proposal Management | `docs/08-business-modules/09-crm-module-architecture.md` | Extend | Second CRM section; merge into the canonical CRM module architecture document. |
| 80 | Customer Service & Case Management | `docs/08-business-modules/09-crm-module-architecture.md` | Extend | Second CRM section; merge into the canonical CRM module architecture document. |
| 81 | CRM Analytics & Customer Intelligence | `docs/08-business-modules/09-crm-module-architecture.md` | Extend | Second CRM section; merge into the canonical CRM module architecture document. |
| 82 | Project Management Module Overview | `docs/08-business-modules/10-project-management-module-architecture.md` | Create |  |
| 83 | Project Master Management | `docs/08-business-modules/10-project-management-module-architecture.md` | Extend |  |
| 84 | Work Breakdown Structure (WBS) | `docs/08-business-modules/10-project-management-module-architecture.md` | Extend |  |
| 85 | Project Planning & Scheduling | `docs/08-business-modules/10-project-management-module-architecture.md` | Extend |  |
| 86 | Resource Management | `docs/08-business-modules/10-project-management-module-architecture.md` | Extend |  |
| 87 | Time Tracking & Timesheets | `docs/08-business-modules/10-project-management-module-architecture.md` | Extend |  |
| 88 | Project Budgeting & Cost Management | `docs/08-business-modules/10-project-management-module-architecture.md` | Extend |  |
| 89 | Project Risk & Issue Management | `docs/08-business-modules/10-project-management-module-architecture.md` | Extend |  |
| 90 | Project Collaboration & Document Management | `docs/08-business-modules/10-project-management-module-architecture.md` | Extend |  |
| 91 | Project Change Management | `docs/08-business-modules/10-project-management-module-architecture.md` | Extend |  |
| 92 | Project Portfolio Management (PPM) | `docs/08-business-modules/10-project-management-module-architecture.md` | Extend |  |
| 93 | Project Analytics & Earned Value Management (EVM) | `docs/08-business-modules/10-project-management-module-architecture.md` | Extend |  |
| 94 | Manufacturing Module Overview | `docs/08-business-modules/06-manufacturing-module-architecture.md` | Merge | Second manufacturing section; merge into the canonical manufacturing module architecture document. |
| 95 | Product Engineering & Item Manufacturing Definition | `docs/08-business-modules/06-manufacturing-module-architecture.md` | Merge | Second manufacturing section; merge into the canonical manufacturing module architecture document. |
| 96 | Bill of Materials (BOM) Management | `docs/08-business-modules/06-manufacturing-module-architecture.md` | Merge | Second manufacturing section; merge into the canonical manufacturing module architecture document. |
| 97 | Routing & Manufacturing Process Management | `docs/08-business-modules/06-manufacturing-module-architecture.md` | Merge | Second manufacturing section; merge into the canonical manufacturing module architecture document. |
| 98 | Work Center & Production Resource Management | `docs/08-business-modules/06-manufacturing-module-architecture.md` | Merge | Second manufacturing section; merge into the canonical manufacturing module architecture document. |
| 99 | Material Requirements Planning (MRP) | `docs/08-business-modules/06-manufacturing-module-architecture.md` | Merge | Second manufacturing section; merge into the canonical manufacturing module architecture document. |
| 100 | Master Production Scheduling (MPS) | `docs/08-business-modules/06-manufacturing-module-architecture.md` | Merge | Second manufacturing section; merge into the canonical manufacturing module architecture document. |
| 101 | Production Order Management | `docs/08-business-modules/06-manufacturing-module-architecture.md` | Merge | Second manufacturing section; merge into the canonical manufacturing module architecture document. |
| 102 | Shop Floor Execution (MES) | `docs/08-business-modules/06-manufacturing-module-architecture.md` | Merge | Second manufacturing section; merge into the canonical manufacturing module architecture document. |
| 103 | Capacity Requirements Planning (CRP) | `docs/08-business-modules/06-manufacturing-module-architecture.md` | Merge | Second manufacturing section; merge into the canonical manufacturing module architecture document. |
| 104 | Production Costing | `docs/08-business-modules/06-manufacturing-module-architecture.md` | Merge | Second manufacturing section; merge into the canonical manufacturing module architecture document. |
| 105 | Quality Management Integration | `docs/08-business-modules/06-manufacturing-module-architecture.md` | Merge | Second manufacturing section; merge into the canonical manufacturing module architecture document. |
| 106 | Production Traceability & Genealogy | `docs/08-business-modules/06-manufacturing-module-architecture.md` | Merge | Second manufacturing section; merge into the canonical manufacturing module architecture document. |
| 107 | Manufacturing Analytics & KPI Management | `docs/08-business-modules/06-manufacturing-module-architecture.md` | Merge | Second manufacturing section; merge into the canonical manufacturing module architecture document. |
| 108 | Manufacturing Module Architecture Summary | `docs/08-business-modules/06-manufacturing-module-architecture.md` | Merge | Second manufacturing section; merge into the canonical manufacturing module architecture document. |
| 109 | Quality Management Module Overview | `docs/08-business-modules/11-quality-management-module-architecture.md` | Create |  |
| 110 | Quality Planning & Specifications | `docs/08-business-modules/11-quality-management-module-architecture.md` | Extend |  |
| 111 | Inspection Management | `docs/08-business-modules/11-quality-management-module-architecture.md` | Extend |  |
| 112 | Sampling Plans & Acceptance Quality Control | `docs/08-business-modules/11-quality-management-module-architecture.md` | Extend |  |
| 113 | Non-Conformance Management (NCM) | `docs/08-business-modules/11-quality-management-module-architecture.md` | Extend |  |
| 114 | Corrective & Preventive Action (CAPA) | `docs/08-business-modules/11-quality-management-module-architecture.md` | Extend |  |
| 115 | Quality Audit Management | `docs/08-business-modules/11-quality-management-module-architecture.md` | Extend |  |
| 116 | Supplier Quality Management | `docs/08-business-modules/11-quality-management-module-architecture.md` | Extend |  |
| 117 | Customer Quality & Complaint Management | `docs/08-business-modules/11-quality-management-module-architecture.md` | Extend |  |
| 118 | Laboratory Information Management (LIMS) Integration | `docs/08-business-modules/11-quality-management-module-architecture.md` | Extend |  |
| 119 | Quality Analytics & Statistical Process Control (SPC) | `docs/08-business-modules/11-quality-management-module-architecture.md` | Extend |  |
| 120 | Quality Management Module Architecture Summary | `docs/08-business-modules/11-quality-management-module-architecture.md` | Extend |  |
| 121 | Enterprise Asset Management Module Overview | `docs/08-business-modules/12-asset-maintenance-module-architecture.md` | Create |  |
| 122 | Asset Registry & Master Data | `docs/08-business-modules/12-asset-maintenance-module-architecture.md` | Extend |  |
| 123 | Asset Hierarchy & Location Management | `docs/08-business-modules/12-asset-maintenance-module-architecture.md` | Extend |  |
| 124 | Asset Lifecycle Management | `docs/08-business-modules/12-asset-maintenance-module-architecture.md` | Extend |  |
| 125 | Warranty & Service Contract Management | `docs/08-business-modules/12-asset-maintenance-module-architecture.md` | Extend |  |
| 126 | Asset Condition Monitoring & Performance Management | `docs/08-business-modules/12-asset-maintenance-module-architecture.md` | Extend |  |
| 127 | Maintenance Management Overview | `docs/08-business-modules/12-asset-maintenance-module-architecture.md` | Extend |  |
| 128 | Maintenance Planning & Scheduling | `docs/08-business-modules/12-asset-maintenance-module-architecture.md` | Extend |  |
| 129 | Work Order Management | `docs/08-business-modules/12-asset-maintenance-module-architecture.md` | Extend |  |
| 130 | Preventive Maintenance Management | `docs/08-business-modules/12-asset-maintenance-module-architecture.md` | Extend |  |
| 131 | Predictive & Condition-Based Maintenance | `docs/08-business-modules/12-asset-maintenance-module-architecture.md` | Extend |  |
| 132 | Breakdown & Emergency Maintenance | `docs/08-business-modules/12-asset-maintenance-module-architecture.md` | Extend |  |
| 133 | Spare Parts & Maintenance Inventory Management | `docs/08-business-modules/12-asset-maintenance-module-architecture.md` | Extend |  |
| 134 | Maintenance Resource & Contractor Management | `docs/08-business-modules/12-asset-maintenance-module-architecture.md` | Extend |  |
| 135 | Maintenance Cost Management & KPIs | `docs/08-business-modules/12-asset-maintenance-module-architecture.md` | Extend |  |
| 136 | Enterprise Asset Management Architecture Summary | `docs/08-business-modules/12-asset-maintenance-module-architecture.md` | Extend |  |
| 137 | Business Intelligence Module Overview | `docs/08-business-modules/13-bi-analytics-module-architecture.md` | Create |  |
| 138 | Enterprise Data Warehouse (EDW) | `docs/08-business-modules/13-bi-analytics-module-architecture.md` | Extend |  |
| 139 | KPI Management & Performance Scorecards | `docs/08-business-modules/13-bi-analytics-module-architecture.md` | Extend |  |
| 140 | Self-Service Analytics & Ad-hoc Reporting | `docs/08-business-modules/13-bi-analytics-module-architecture.md` | Extend |  |
| 141 | Predictive Analytics & Forecasting | `docs/08-business-modules/13-bi-analytics-module-architecture.md` | Extend |  |
| 142 | Enterprise Reporting Framework | `docs/08-business-modules/13-bi-analytics-module-architecture.md` | Extend |  |
| 143 | Executive Dashboards & Decision Support | `docs/08-business-modules/13-bi-analytics-module-architecture.md` | Extend |  |
| 144 | AI-Assisted Analytics & Enterprise Insights | `docs/08-business-modules/13-bi-analytics-module-architecture.md` | Extend |  |
| 145 | Data Governance & Enterprise Metadata Management | `docs/03-database/20-master-data-management.md` | Create | Master data / metadata governance aligns with database canonical ownership. |
| 146 | Enterprise Search & Knowledge Discovery | `docs/08-business-modules/13-bi-analytics-module-architecture.md` | Extend |  |
| 147 | Business Intelligence Architecture Summary | `docs/08-business-modules/13-bi-analytics-module-architecture.md` | Extend |  |
| 148 | Workflow & Business Process Management Overview | `docs/08-business-modules/14-workflow-bpm-module-architecture.md` | Create |  |
| 149 | Workflow Definitions & Process Modeling | `docs/08-business-modules/14-workflow-bpm-module-architecture.md` | Extend |  |
| 150 | Task Management & Human Workflow | `docs/08-business-modules/14-workflow-bpm-module-architecture.md` | Extend |  |
| 151 | Approval Management & Decision Workflows | `docs/08-business-modules/14-workflow-bpm-module-architecture.md` | Extend |  |
| 152 | Business Rules Engine | `docs/08-business-modules/14-workflow-bpm-module-architecture.md` | Extend |  |
| 153 | Event-Driven Automation | `docs/08-business-modules/14-workflow-bpm-module-architecture.md` | Extend |  |
| 154 | SLA Management & Escalation Framework | `docs/08-business-modules/14-workflow-bpm-module-architecture.md` | Extend |  |
| 155 | Notification & Communication Framework | `docs/09-platform-services/01-platform-service-architecture.md` | Extend | Platform service architecture content; centralized service ownership in platform services. |
| 156 | Process Monitoring & Workflow Analytics | `docs/08-business-modules/14-workflow-bpm-module-architecture.md` | Extend |  |
| 157 | Robotic Process Automation (RPA) Integration | `docs/08-business-modules/14-workflow-bpm-module-architecture.md` | Extend |  |
| 158 | Low-Code Process Automation | `docs/08-business-modules/14-workflow-bpm-module-architecture.md` | Extend |  |
| 159 | Workflow & BPM Architecture Summary | `docs/08-business-modules/14-workflow-bpm-module-architecture.md` | Extend |  |
| 160 | Enterprise Integration Platform Overview | `docs/09-platform-services/02-enterprise-integration-platform.md` | Create | Enterprise integration topics belong in the integration platform canonical document. |
| 161 | API Management Platform | `docs/09-platform-services/02-enterprise-integration-platform.md` | Extend | Enterprise integration topics belong in the integration platform canonical document. |
| 162 | Messaging, Event Streaming & Enterprise Service Bus | `docs/09-platform-services/02-enterprise-integration-platform.md` | Extend | Enterprise integration topics belong in the integration platform canonical document. |
| 163 | Connector Framework & External Systems Integration | `docs/09-platform-services/02-enterprise-integration-platform.md` | Extend | Enterprise integration topics belong in the integration platform canonical document. |
| 164 | Data Synchronization & Master Data Exchange | `docs/09-platform-services/02-enterprise-integration-platform.md` | Extend | Enterprise integration topics belong in the integration platform canonical document. |
| 165 | Enterprise Integration Monitoring & Observability | `docs/09-platform-services/02-enterprise-integration-platform.md` | Extend | Enterprise integration topics belong in the integration platform canonical document. |
| 166 | Electronic Data Interchange (EDI) & B2B Integration | `docs/09-platform-services/02-enterprise-integration-platform.md` | Extend | Enterprise integration topics belong in the integration platform canonical document. |
| 167 | File Exchange & Managed File Transfer (MFT) | `docs/09-platform-services/02-enterprise-integration-platform.md` | Extend | Enterprise integration topics belong in the integration platform canonical document. |
| 168 | Integration Architecture Summary | `docs/09-platform-services/02-enterprise-integration-platform.md` | Extend | Enterprise integration topics belong in the integration platform canonical document. |
| 169 | Artificial Intelligence Platform Overview | `docs/09-platform-services/03-ai-platform-architecture.md` | Create |  |
| 170 | Machine Learning Lifecycle Management (MLOps) | `docs/09-platform-services/03-ai-platform-architecture.md` | Extend |  |
| 171 | Intelligent Enterprise Assistants & AI Copilots | `docs/09-platform-services/03-ai-platform-architecture.md` | Extend |  |
| 172 | Enterprise Security Architecture | `docs/06-security/04-enterprise-security-architecture.md` | Create | Enterprise security architecture belongs in security canonical documents. |
| 173 | Identity & Access Management (IAM) | `docs/06-security/04-enterprise-security-architecture.md` | Extend | Enterprise security architecture belongs in security canonical documents. |
| 174 | Authentication & Session Management | `docs/06-security/04-enterprise-security-architecture.md` | Extend | Enterprise security architecture belongs in security canonical documents. |
| 175 | Enterprise Authorization Framework | `docs/06-security/04-enterprise-security-architecture.md` | Extend | Enterprise security architecture belongs in security canonical documents. |
| 176 | Secrets, Cryptography & Certificate Management | `docs/06-security/04-enterprise-security-architecture.md` | Extend | Enterprise security architecture belongs in security canonical documents. |
| 177 | Audit, Compliance & Governance | `docs/06-security/04-enterprise-security-architecture.md` | Extend | Enterprise security architecture belongs in security canonical documents. |
| 178 | Security Monitoring & Incident Management | `docs/06-security/04-enterprise-security-architecture.md` | Extend | Enterprise security architecture belongs in security canonical documents. |
| 179 | Privacy & Data Protection | `docs/06-security/04-enterprise-security-architecture.md` | Extend | Enterprise security architecture belongs in security canonical documents. |
| 180 | Enterprise Security Platform Architecture Summary | `docs/06-security/04-enterprise-security-architecture.md` | Extend | Enterprise security architecture belongs in security canonical documents. |


## Reconciliation actions (automated)

- Date: 2026-08-08T20:37:56.641+05:30
- Lead engineer: Lead Enterprise Architect (automated reconciliation)
- Owner resolutions recorded in: `docs/migration-traceability/volume6-owner-resolutions.md`
- Non-destructive canonical headers inserted into Volume 6 destination files under `docs/08-business-modules/`, `docs/09-platform-services/`, `docs/03-database/`, `docs/06-security/`, and key backend integration files. All original Volume 6 content preserved.
- Disposition: KEEP + CROSS-REFERENCE used by default for cross-cutting topics (Identity/RBAC, Workflow/BPM, BI/MDM, AI Platform).