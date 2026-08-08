Enterprise ERP Software Architecture Document
Volume 2
Database Architecture & Standards
Version 1.0
________________________________________
Copyright
This document defines the official database architecture, standards, conventions, and engineering practices governing the Enterprise ERP Platform.
Every database object, including schemas, tables, indexes, views, functions, procedures, triggers, constraints, sequences, and migrations, shall comply with the standards defined within this document.
Deviation from these standards requires approval through an Architecture Decision Record (ADR).
________________________________________
Table of Contents
Part I — Database Philosophy
Chapter 1 Database Vision
Chapter 2 Database Design Principles
Chapter 3 Data Ownership
________________________________________
Part II — Database Standards
Chapter 4 Naming Conventions
Chapter 5 Schema Organization
Chapter 6 Data Types
Chapter 7 Primary Keys
Chapter 8 Foreign Keys
Chapter 9 Audit Columns
Chapter 10 Soft Deletes
Chapter 11 Versioning
________________________________________
Part III — Database Architecture
Chapter 12 Multi-Tenant Architecture
Chapter 13 Organization Isolation
Chapter 14 Shared Data
Chapter 15 Master Data
Chapter 16 Transaction Data
________________________________________
Part IV — Performance
Chapter 17 Index Strategy
Chapter 18 Query Optimization
Chapter 19 Partitioning
Chapter 20 Archiving
________________________________________
Part V — Reliability
Chapter 21 Constraints
Chapter 22 Transactions
Chapter 23 Locking Strategy
Chapter 24 Backup Strategy
Chapter 25 Disaster Recovery
________________________________________
Part VI — Development Standards
Chapter 26 Migration Strategy
Chapter 27 Seed Data
Chapter 28 Testing
Chapter 29 Documentation
________________________________________
PART I
Database Philosophy
________________________________________
Chapter 1
Database Vision
1.1 Introduction
The database is the foundation of the Enterprise ERP Platform.
Unlike application code, which evolves frequently over the lifetime of a software product, business data must remain accurate, consistent, and accessible for many years.
The database therefore represents the most valuable asset of the ERP platform.
Every architectural decision concerning application development shall prioritize the integrity, security, and longevity of business data.
________________________________________
1.2 Purpose
The primary purpose of the database is to provide a reliable, consistent, and scalable repository for all organizational information.
The database shall support:
•	Operational transactions
•	Historical records
•	Reporting
•	Analytics
•	Auditing
•	Regulatory compliance
•	Disaster recovery
The database is not merely a storage mechanism but the authoritative business record of every organization using the ERP.
________________________________________
1.3 Database as the Source of Truth
The PostgreSQL database shall be regarded as the single source of truth for all persistent business information.
No application component, client device, cache, or external service shall be considered authoritative for business data.
Whenever discrepancies occur between cached information and the database, the database shall take precedence.
________________________________________
1.4 Data Integrity
Protecting business information is the highest priority of the database architecture.
Data integrity shall be maintained through:
•	Primary Keys
•	Foreign Keys
•	Unique Constraints
•	Check Constraints
•	Transactions
•	Referential Integrity
•	Controlled Updates
Application code shall never bypass these protections for convenience.
________________________________________
1.5 Long-Term Stability
ERP systems often remain operational for decades.
Accordingly, the database must be designed to evolve without compromising historical data.
Schema evolution shall prioritize backward compatibility whenever practical.
Breaking changes shall be carefully planned, documented, and migrated.
________________________________________
1.6 Scalability
The database architecture shall support gradual growth without requiring redesign.
Growth considerations include:
•	Organizations
•	Branches
•	Users
•	Modules
•	Transactions
•	Financial Years
•	Documents
•	Reports
The database should support millions of records while maintaining acceptable performance.
________________________________________
1.7 Maintainability
A database should be understandable by developers who were not involved in its original design.
To achieve this:
•	Naming conventions shall be consistent.
•	Table structures shall be standardized.
•	Relationships shall be explicit.
•	Documentation shall accompany every major schema.
Readability shall be valued equally with performance.
________________________________________
1.8 Security
Database security extends beyond authentication.
The architecture shall provide protection through:
•	Role separation
•	Least privilege
•	Secure connections
•	Encryption where appropriate
•	Audit logging
•	Controlled administrative access
Sensitive information shall never be stored without appropriate protection mechanisms.
________________________________________
1.9 Summary
The database is the permanent foundation of the ERP platform.
Every future database decision documented within this volume shall support the principles established in this chapter.
________________________________________
Chapter 2
Database Design Principles
2.1 Introduction
A well-designed database is not merely normalized tables connected through foreign keys.
It is a carefully structured representation of business reality.
Every table, relationship, constraint, and index exists to represent a business concept and to preserve the accuracy of that representation over time.
The following principles govern every database object within the ERP.
________________________________________
2.2 Business Before Technology
Tables shall model business concepts rather than application screens.
For example:
Correct
•	Customer
•	Supplier
•	Invoice
•	Purchase Order
•	Warehouse
Incorrect
•	CustomerScreen
•	PurchaseForm
•	DashboardData
The database models the business, not the user interface.
________________________________________
2.3 Consistency
Every module shall follow identical database conventions.
Examples include:
•	Primary key naming
•	Foreign key naming
•	Audit fields
•	Timestamp columns
•	Boolean naming
•	Index naming
Consistency significantly reduces maintenance complexity.
________________________________________
2.4 Explicit Relationships
Relationships between business entities shall always be represented explicitly.
Foreign keys shall not be replaced with free-text identifiers.
For example:
Invoice → Customer
Invoice → Branch
Invoice → Financial Year
Invoice → Organization
These relationships enforce business correctness.
________________________________________
2.5 Controlled Redundancy
Data duplication should generally be avoided.
However, controlled redundancy is acceptable where required for:
•	Historical accuracy
•	Reporting performance
•	Audit preservation
•	Regulatory compliance
Such duplication shall always be documented.
________________________________________
2.6 Immutable Business History
Historical business transactions should rarely be modified after completion.
Examples include:
•	Posted Invoices
•	Accounting Entries
•	Payment Records
•	Audit Logs
Corrections should generally occur through reversing entries rather than destructive updates.
This principle preserves traceability and financial accuracy.
________________________________________
2.7 Standardization
Every transactional table shall follow a common structural pattern wherever applicable.
This includes:
•	Primary Key
•	Organization Reference
•	Branch Reference
•	Financial Year
•	Audit Fields
•	Status
•	Version
•	Soft Delete Flag
Standardization simplifies tooling, reporting, and maintenance.
________________________________________
2.8 Documentation
Every database object shall have documented business meaning.
A developer should be able to understand:
•	Why the table exists.
•	What each column represents.
•	Which module owns it.
•	Which APIs use it.
•	Which reports consume it.
Documentation is considered part of the schema.
________________________________________
2.9 Summary
These principles provide the conceptual framework for all database design decisions.
Subsequent chapters shall define the mandatory implementation standards that every schema object must follow.
End of Volume 2 — Part I (Chapters 1 & 2)

Enterprise ERP Software Architecture Document
Volume 2 — Database Architecture & Standards
Version: 1.0
Part I — Database Philosophy
________________________________________
Chapter 3
Data Ownership
________________________________________
3.1 Introduction
One of the primary causes of complexity in enterprise software is the absence of clearly defined ownership of business data. As systems evolve, multiple modules begin reading, modifying, and validating the same data without well-defined boundaries. This often results in duplicated business logic, inconsistent validation rules, conflicting updates, and increased maintenance costs.
To prevent these issues, the Enterprise ERP Platform adopts a strict Data Ownership Model.
Under this model, every piece of business data has one—and only one—authoritative owner. Ownership defines which module is responsible for creating, validating, updating, protecting, and documenting a specific business entity.
This principle is fundamental to the modular architecture of the ERP and shall apply to every current and future module.
________________________________________
3.2 Purpose
The purpose of data ownership is to establish clear accountability for every business entity stored within the database.
A well-defined ownership model provides the following benefits:
•	Eliminates ambiguity regarding responsibility.
•	Prevents duplicate business logic.
•	Reduces unintended side effects during development.
•	Simplifies testing.
•	Supports modular deployment.
•	Enables independent evolution of modules.
•	Improves long-term maintainability.
Data ownership is an architectural principle rather than merely a database convention.
________________________________________
3.3 Definition of Ownership
A module is considered the owner of a database object when it is responsible for:
•	Defining the table structure.
•	Maintaining the schema.
•	Creating migration scripts.
•	Enforcing business validation.
•	Defining lifecycle rules.
•	Maintaining documentation.
•	Exposing official APIs.
•	Managing permissions.
•	Preserving historical integrity.
Ownership does not imply exclusive access.
Other modules may reference or read the data, but only the owning module is permitted to define how that data behaves.
________________________________________
3.4 Single Ownership Principle
Every database object shall have exactly one owner.
The following ownership models are prohibited:
•	Multiple owning modules.
•	Shared business logic across unrelated modules.
•	Circular ownership.
•	Undefined ownership.
For example:
Customer Table
Owner:
Customer Management Module
Consumers:
•	Sales
•	Purchase
•	CRM
•	Accounting
•	Service Management
Although several modules use customer information, only the Customer Management Module determines how customers are created, modified, merged, archived, or deleted.
________________________________________
3.5 Module Responsibilities
Every module is responsible for the complete lifecycle of the data it owns.
This includes:
Schema Design
The module defines:
•	Tables
•	Columns
•	Constraints
•	Relationships
•	Indexes
________________________________________
Business Rules
Examples include:
•	Validation
•	Status transitions
•	Approval requirements
•	Posting rules
•	Cancellation rules
Business rules shall never be duplicated by consuming modules.
________________________________________
API Exposure
The owning module publishes official APIs.
Other modules shall consume these APIs rather than implementing alternative methods for manipulating owned data.
________________________________________
Documentation
Every owned entity shall be documented.
Documentation includes:
•	Business purpose
•	Relationships
•	Lifecycle
•	Dependencies
•	Constraints
________________________________________
3.6 Data Consumers
Modules frequently require access to data owned by other modules.
These modules are referred to as Consumers.
Examples:
Sales Module
Consumes:
•	Customer
•	Product
•	Warehouse
•	Tax Configuration
•	Currency
Ownership remains unchanged.
Sales does not become responsible for customer maintenance simply because it references customer information.
________________________________________
3.7 Read Access
Read access is unrestricted provided appropriate security permissions exist.
Examples:
Inventory
may read
Warehouse
Accounting
may read
Customer
Manufacturing
may read
Item
Read access does not transfer ownership.
________________________________________
3.8 Write Access
Write access shall be carefully controlled.
The following operations require ownership:
•	Create
•	Update
•	Delete
•	Archive
•	Merge
•	Restore
Non-owning modules should avoid directly modifying foreign business entities.
Where updates are necessary, they shall occur through published service interfaces.
________________________________________
3.9 Cross-Module Relationships
Relationships between modules shall occur through stable business references.
Example:
Sales Invoice
references
Customer
Item
Warehouse
Sales owns:
•	Sales Invoice
•	Sales Invoice Line
Sales does not own:
•	Customer
•	Item
•	Warehouse
The relationship is established through foreign keys rather than duplicated business information.
________________________________________
3.10 Shared Platform Data
Some entities belong to the ERP platform itself rather than business modules.
Examples include:
•	Organization
•	Branch
•	Module Registry
•	Subscription
•	Currency
•	Country
•	Language
•	Time Zone
•	Attachment
•	Audit Log
These entities provide infrastructure services used throughout the platform.
Ownership resides with the Platform Core.
Business modules may reference platform entities but shall not redefine their behavior.
________________________________________
3.11 Master Data Ownership
Master data represents reusable business entities.
Examples include:
•	Customer
•	Supplier
•	Product
•	Employee
•	Warehouse
•	Asset
Each master entity shall have exactly one owning module.
Master data should remain reusable across the ERP rather than duplicated within individual modules.
________________________________________
3.12 Transaction Data Ownership
Transaction data represents business events.
Examples include:
•	Sales Invoice
•	Purchase Order
•	Stock Transaction
•	Journal Entry
•	Payment
•	Receipt
Transaction ownership remains with the module that creates the transaction.
Example:
Sales Module owns:
•	Sales Quotation
•	Sales Order
•	Delivery Note
•	Sales Invoice
•	Sales Return
Accounting may generate journal entries from a sales invoice, but ownership of the invoice remains with the Sales Module.
________________________________________
3.13 Derived Data
Some information is generated from existing business records.
Examples include:
•	Inventory summaries
•	Customer balances
•	Monthly sales reports
•	Profit analysis
Derived data shall never become the primary business record.
The originating transaction remains authoritative.
Derived data may be regenerated whenever required.
________________________________________
3.14 Historical Data
Historical records shall retain their original ownership.
Completed transactions should not be transferred between modules.
Ownership remains unchanged even after:
•	Posting
•	Approval
•	Financial Year Closure
•	Archiving
Historical consistency is essential for auditing and regulatory compliance.
________________________________________
3.15 Integration Rules
External systems shall interact with ERP data through published APIs.
Direct database modification by external applications is prohibited unless explicitly approved.
Reasons include:
•	Validation
•	Security
•	Audit Logging
•	Version Compatibility
APIs provide a stable contract between the ERP and external integrations.
________________________________________
3.16 Data Ownership Matrix
The following table illustrates the ownership model for selected business entities.
Business Entity	Owning Module	Typical Consumers
Organization	Platform Core	All Modules
Branch	Platform Core	All Modules
User	Identity & Access	All Modules
Role	Identity & Access	All Modules
Permission	Identity & Access	All Modules
Customer	Customer Management	Sales, Accounting, CRM
Supplier	Supplier Management	Purchase, Accounting
Item	Inventory	Sales, Purchase, Manufacturing
Warehouse	Inventory	Sales, Purchase, Manufacturing
Sales Invoice	Sales	Accounting, Reporting
Purchase Order	Purchase	Inventory, Accounting
Journal Entry	Accounting	Reporting
Employee	Human Resources	Payroll
Payroll Run	Payroll	Accounting
This matrix is illustrative. A complete ownership matrix shall be maintained as part of the ERP module documentation.
________________________________________
3.17 Ownership Violations
The following practices are prohibited:
•	Duplicating master data across modules.
•	Updating another module's tables directly.
•	Implementing business rules for foreign entities.
•	Creating undocumented dependencies.
•	Sharing ownership of the same table.
•	Circumventing published APIs.
Violations of these rules increase coupling and reduce maintainability.
________________________________________
3.18 Architectural Benefits
Adopting a strict ownership model provides numerous long-term advantages.
Maintainability
Each module evolves independently.
Scalability
Additional modules can be introduced without redesigning existing modules.
Security
Permissions can be enforced at the module boundary.
Testing
Each module can be tested in isolation.
Documentation
Responsibilities remain clearly defined.
Deployment
Future deployments may package modules independently.
________________________________________
3.19 Relationship to Other Chapters
The ownership principles established in this chapter influence several subsequent chapters within this volume.
Specifically:
•	Chapter 5 — Database Schema Organization
•	Chapter 8 — Foreign Keys
•	Chapter 12 — Multi-Tenant Architecture
•	Chapter 16 — Transaction Data
Readers are encouraged to consider this chapter the conceptual foundation for all subsequent database design decisions.
________________________________________
3.20 Summary
Data ownership is one of the most important architectural principles of the Enterprise ERP Platform.
Every business entity shall have exactly one authoritative owner responsible for its lifecycle, validation, schema, documentation, and APIs.
By separating ownership from consumption, the ERP achieves true modularity while preserving data integrity and long-term maintainability.
The principles established in this chapter shall govern the design of every database object throughout the platform.
End of Chapter 3

Enterprise ERP Software Architecture Document
Volume 2 — Database Architecture & Standards
Version: 1.0
Part II — Database Standards
________________________________________
Chapter 4
Database Naming Conventions
________________________________________
4.1 Introduction
A database is one of the longest-lived components of an enterprise software system. While application code evolves frequently, database schemas often remain in production for many years and are maintained by multiple development teams.
Inconsistent naming introduces ambiguity, increases onboarding time, complicates debugging, and reduces maintainability.
For these reasons, the Enterprise ERP Platform adopts a strict, standardized naming convention for every database object.
These conventions are mandatory for all current and future modules.
________________________________________
4.2 Objectives
The naming standards defined in this chapter are intended to achieve the following objectives:
•	Human readability.
•	Predictable structure.
•	Consistent implementation.
•	Simplified maintenance.
•	Improved documentation.
•	Better tool compatibility.
•	Easier code generation.
•	Reduced development errors.
A developer should be able to identify the purpose of a database object from its name alone.
________________________________________
4.3 General Naming Rules
Every database object shall comply with the following general rules.
Rule 1 — Use Lowercase Characters
All identifiers shall be written in lowercase.
Correct
customer
sales_invoice
inventory_transaction
Incorrect
Customer
SalesInvoice
InventoryTransaction
Lowercase identifiers eliminate unnecessary quoting and improve compatibility across development tools.
________________________________________
Rule 2 — Use Snake Case
Multiple words shall be separated using underscores.
Correct
purchase_order
sales_return
employee_salary
Incorrect
purchaseOrder
PurchaseOrder
purchase-order
________________________________________
Rule 3 — Use Meaningful Business Names
Database objects shall represent business concepts rather than implementation details.
Correct
customer
supplier
warehouse
sales_invoice
Incorrect
customer_screen
sales_form
invoice_grid
The database models business information—not user interfaces.
________________________________________
Rule 4 — Avoid Unnecessary Abbreviations
Names shall be written in full wherever practical.
Preferred
organization
financial_year
warehouse
Avoid
org
fy
wh
Accepted technical abbreviations include:
•	id
•	uuid
•	api
•	jwt
•	url
________________________________________
4.4 Table Naming Standards
Tables shall use singular nouns.
Examples:
organization
branch
customer
supplier
item
warehouse
employee
sales_invoice
purchase_order
Plural table names are not permitted.
Using singular names better reflects the fact that each row represents one business entity.
________________________________________
4.5 Column Naming Standards
Column names shall clearly describe the information stored.
Examples:
customer_name
phone_number
email_address
tax_registration_number
Avoid generic names whenever possible.
Poor
name
number
description
Preferred
customer_name
invoice_number
warehouse_description
Self-descriptive names improve readability without requiring table context.
________________________________________
4.6 Identifier Naming
Every table shall contain a primary identifier named:
id
The column shall never include the table name.
Correct:
customer
---------
id
customer_code
customer_name
Incorrect:
customer
---------
customer_id
Foreign keys shall always include the referenced table name.
Example:
customer_id
organization_id
branch_id
currency_id
________________________________________
4.7 Boolean Columns
Boolean columns shall begin with descriptive prefixes.
Recommended prefixes:
is_
has_
can_
allow_
enable_
Examples:
is_active
is_deleted
has_attachment
can_edit
allow_discount
enable_notifications
Avoid ambiguous boolean names such as:
active
deleted
attachment
________________________________________
4.8 Date and Time Columns
Timestamp columns shall use standardized suffixes.
Mandatory audit timestamps include:
created_at
updated_at
deleted_at
Business-specific timestamps should describe the business event.
Examples:
invoice_date
posting_date
delivery_date
joining_date
approval_date
________________________________________
4.9 Monetary Columns
Financial columns shall include their business meaning.
Examples:
gross_amount
discount_amount
tax_amount
net_amount
paid_amount
balance_amount
Avoid generic names such as:
amount
value
total
unless the meaning is completely unambiguous.
________________________________________
4.10 Constraint Naming
To simplify troubleshooting and maintenance, every constraint shall follow a predictable naming convention.
Primary Keys
pk_<table>
Example:
pk_customer
________________________________________
Foreign Keys
fk_<table>_<referenced_table>
Examples:
fk_sales_invoice_customer
fk_purchase_order_supplier
________________________________________
Unique Constraints
uk_<table>_<column>
Examples:
uk_customer_code
uk_user_email
________________________________________
Check Constraints
chk_<table>_<rule>
Examples:
chk_quantity_positive
chk_discount_valid
________________________________________
4.11 Index Naming
Indexes shall use:
idx_<table>_<column>
Examples:
idx_customer_name
idx_sales_invoice_date
idx_item_barcode
Composite indexes shall include the participating columns in logical order.
________________________________________
4.12 Sequence Naming
Database sequences shall use:
seq_<table>
Examples:
seq_customer
seq_sales_invoice
________________________________________
4.13 Trigger Naming
Triggers shall use:
trg_<table>_<purpose>
Examples:
trg_customer_audit
trg_sales_invoice_number
trg_stock_recalculation
________________________________________
4.14 View Naming
Views shall begin with:
vw_
Examples:
vw_inventory_summary
vw_customer_balance
vw_monthly_sales
Materialized views shall begin with:
mv_
Example:
mv_sales_dashboard
________________________________________
4.15 Function Naming
Database functions shall begin with an action verb.
Examples:
calculate_inventory_balance()
generate_invoice_number()
validate_tax_registration()
Function names should describe business intent rather than technical implementation.
________________________________________
4.16 Naming Checklist
Before introducing any database object, developers shall verify that it satisfies the following checklist:
•	Uses lowercase characters.
•	Uses snake_case.
•	Represents a business concept.
•	Avoids unnecessary abbreviations.
•	Follows the correct prefix convention.
•	Is unique within its scope.
•	Matches the standards defined in this chapter.
________________________________________
4.17 Summary
Consistent naming is a foundational element of database quality.
Every object created within the ERP shall follow these conventions without exception unless explicitly approved through an Architecture Decision Record.

---

Chapter 5
Database Schema Organization
________________________________________
5.1 Introduction
As the ERP evolves, the database will contain hundreds of tables, views, indexes, functions, and other objects distributed across numerous business domains.
Without a disciplined organizational structure, the database becomes increasingly difficult to understand, maintain, and extend.
Schema organization defines how database objects are grouped, owned, documented, and managed throughout the lifecycle of the ERP.
________________________________________
5.2 Objectives
The schema organization strategy has the following objectives:
•	Clear ownership.
•	Modular development.
•	Reduced coupling.
•	Easier maintenance.
•	Predictable deployment.
•	Better security.
•	Improved scalability.
________________________________________
5.3 Organizational Principles
The database shall be organized according to business ownership rather than technical implementation.
Each table shall belong to one business module or one platform service.
Ownership shall be explicit and documented.
This principle extends the Data Ownership Model introduced in Chapter 3.
________________________________________
5.4 Platform Layer
Certain database objects provide services required by the entire ERP platform.
Examples include:
•	organization
•	branch
•	financial_year
•	module
•	subscription
•	user
•	role
•	permission
•	audit_log
•	attachment
These objects form the platform layer.
Business modules depend on them, but they are not owned by any individual business domain.
________________________________________
5.5 Business Modules
Each business module shall own its own schema objects.
Illustrative examples include:
Sales Module
•	sales_quotation
•	sales_order
•	sales_invoice
•	sales_return
Purchase Module
•	purchase_requisition
•	purchase_order
•	purchase_invoice
•	purchase_return
Inventory Module
•	item
•	warehouse
•	stock_transaction
•	inventory_adjustment
Each module is responsible for the complete lifecycle of its objects.
________________________________________
5.6 Categories of Tables
To improve consistency, tables shall be categorized according to their purpose.
Reference Tables
Contain stable reference information.
Examples:
•	country
•	currency
•	language
•	unit_of_measure
________________________________________
Master Tables
Represent reusable business entities.
Examples:
•	customer
•	supplier
•	employee
•	warehouse
________________________________________
Transaction Tables
Capture business events.
Examples:
•	sales_invoice
•	purchase_order
•	journal_entry
•	payment
________________________________________
Configuration Tables
Control ERP behavior.
Examples:
•	tax_configuration
•	numbering_configuration
•	approval_configuration
________________________________________
Audit Tables
Record historical activity.
Examples:
•	audit_log
•	login_history
•	activity_log
________________________________________
5.7 Dependencies Between Modules
Modules shall communicate through defined relationships rather than unrestricted access.
For example:
The Sales module may reference:
•	customer
•	item
•	warehouse
However, it shall not modify the internal behavior or business rules of those entities.
Module dependencies should remain minimal and well documented.
________________________________________
5.8 Shared Business Entities
Some business entities are intentionally shared across multiple modules.
Examples include:
•	Customer
•	Supplier
•	Item
•	Warehouse
•	Currency
Although shared, ownership remains with a single module.
Other modules consume these entities through foreign key relationships and published APIs.
________________________________________
5.9 Reporting Objects
Reporting objects shall remain separate from operational transaction tables.
Examples include:
•	Views
•	Materialized Views
•	Summary Tables
Reports should derive information from transactional data rather than becoming the authoritative source themselves.
________________________________________
5.10 Future Expansion
The schema organization strategy shall support the addition of future modules without restructuring the existing database.
Potential future modules include:
•	Fleet Management
•	Quality Assurance
•	Service Management
•	Help Desk
•	Point of Sale
•	E-Commerce
•	Customer Portal
•	Vendor Portal
•	AI Services
Adding a new module should primarily involve creating new schema objects owned by that module while reusing shared platform entities.
________________________________________
5.11 Documentation Requirements
Every schema object shall have associated documentation identifying:
•	Owning module.
•	Business purpose.
•	Relationships.
•	Dependencies.
•	Referencing APIs.
•	Security considerations.
This documentation shall be maintained alongside the database schema.
________________________________________
5.12 Summary
A well-organized schema is essential for building a modular ERP platform.
By grouping database objects according to business ownership and maintaining clear boundaries between platform services and business modules, the ERP remains understandable, extensible, and maintainable as it grows over time.
The organizational principles established in this chapter shall guide all future database design decisions.
---

Chapter 6
Data Types & Column Standards
________________________________________
6.1 Introduction
Selecting appropriate data types is one of the most important aspects of database design. An unsuitable data type can lead to wasted storage, poor performance, inaccurate calculations, difficult migrations, and inconsistent business behavior.
The purpose of this chapter is to define a standardized set of data types that shall be used throughout the Enterprise ERP Platform.
Every database table created within the ERP shall comply with these standards unless an Architecture Decision Record (ADR) explicitly approves an exception.
________________________________________
6.2 Objectives
This chapter aims to achieve the following objectives:
•	Consistent database design.
•	Predictable storage requirements.
•	Accurate business calculations.
•	Simplified maintenance.
•	Improved query performance.
•	Reduced implementation errors.
•	Easier integration between modules.
________________________________________
6.3 General Principles
The following principles apply to every column within the database.
Principle 1
Every column shall represent exactly one business attribute.
Columns shall never contain multiple unrelated values.
Incorrect
phone_numbers
Correct
primary_phone_number
secondary_phone_number
or
A separate contact table.
________________________________________
Principle 2
Every column shall use the smallest data type capable of representing the business requirement without sacrificing future scalability.
________________________________________
Principle 3
Data types shall be selected according to business meaning rather than current application requirements.
For example:
An invoice number is not a numeric value merely because it contains digits.
It is an identifier.
Therefore it should normally be stored as text.
________________________________________
6.4 Standard Data Types
The ERP officially supports the following PostgreSQL data types.
Business Purpose	PostgreSQL Type
Identifier	UUID
Name	VARCHAR
Description	TEXT
Integer Count	INTEGER
Monetary Value	NUMERIC
Percentage	NUMERIC
Date	DATE
Timestamp	TIMESTAMPTZ
Boolean	BOOLEAN
JSON Configuration	JSONB
Binary Files	BYTEA (Rarely)
No alternative types should be introduced without architectural review.
________________________________________
6.5 Character Data
VARCHAR
VARCHAR shall be used for:
•	Customer Name
•	Product Name
•	Branch Name
•	City Name
•	Invoice Number
•	GST Number
•	Email Address
VARCHAR length should be selected according to business requirements.
Developers shall avoid unnecessarily large limits such as:
VARCHAR(5000)
unless justified.
________________________________________
TEXT
TEXT shall be used for:
•	Notes
•	Comments
•	Long descriptions
•	Email body
•	Terms & Conditions
TEXT should not be used simply because determining a suitable VARCHAR length requires additional effort.
________________________________________
6.6 Numeric Data
INTEGER
INTEGER shall be used for:
•	Quantity
•	Display Order
•	Sequence Number
•	Age
•	Rating
INTEGER shall not be used for monetary values.
________________________________________
BIGINT
BIGINT may be used when values are expected to exceed INTEGER capacity.
Examples include:
•	Large counters
•	Future analytics
•	Import tracking
Business identifiers shall continue using UUID regardless of table size.
________________________________________
6.7 Monetary Data
Financial information is among the most sensitive data stored within the ERP.
Accordingly, floating-point data types shall never be used for financial calculations.
Mandatory type:
NUMERIC(18,4)
Recommended usage:
•	Unit Price
•	Discount
•	Tax
•	Exchange Rate
•	Ledger Amount
•	Total Value
Higher precision may be introduced where business requirements justify it.
________________________________________
6.8 Percentage Values
Percentages shall use
NUMERIC(7,4)
Examples:
•	GST
•	VAT
•	Discount %
•	Interest Rate
•	Commission %
Percentages shall never use floating-point types.
________________________________________
6.9 Date Types
DATE
Used for business dates.
Examples:
•	Invoice Date
•	Delivery Date
•	Joining Date
•	Birth Date
DATE contains no time component.
________________________________________
TIMESTAMPTZ
TIMESTAMPTZ shall be the standard timestamp type throughout the ERP.
Examples:
•	Created At
•	Updated At
•	Approved At
•	Posted At
•	Deleted At
Using timezone-aware timestamps simplifies global deployments.
________________________________________
6.10 Boolean
BOOLEAN shall represent binary business decisions.
Examples:
is_active
is_deleted
allow_backorder
can_cancel
enable_notifications
Boolean columns shall never represent multiple business states.
If more than two states exist, an enumeration or lookup table should be considered.
________________________________________
6.11 UUID
Every primary business entity shall use UUID as its identifier.
UUID provides:
•	Global uniqueness.
•	Safer distributed systems.
•	Easier synchronization.
•	Better API compatibility.
•	Reduced exposure of business volume.
The UUID strategy is discussed in detail in Chapter 7.
________________________________________
6.12 JSONB
JSONB shall be used sparingly.
Appropriate use cases include:
•	Dynamic settings.
•	Feature flags.
•	User preferences.
•	Import metadata.
•	API payload archives.
JSONB shall not replace properly normalized relational structures.
________________________________________
6.13 Enumerations
Small sets of stable values may be represented using PostgreSQL ENUM types or reference tables.
Examples:
•	Gender
•	Document Status
•	Payment Method
•	Approval Status
Business-critical enumerations should be documented centrally.
________________________________________
6.14 NULL Handling
NULL represents "unknown" or "not applicable."
NULL shall not be used to represent:
•	Empty String
•	Zero
•	False
Developers must distinguish between "missing information" and valid business values.
________________________________________
6.15 Default Values
Default values shall represent genuine business defaults.
Examples:
is_active = true
created_at = CURRENT_TIMESTAMP
Artificial defaults introduced merely to simplify application code are discouraged.
________________________________________
6.16 Data Type Matrix
Business Attribute	Recommended Type
Primary Key	UUID
Name	VARCHAR
Code	VARCHAR
Description	TEXT
Quantity	NUMERIC(18,4)
Amount	NUMERIC(18,4)
Percentage	NUMERIC(7,4)
Date	DATE
Timestamp	TIMESTAMPTZ
Boolean	BOOLEAN
Configuration	JSONB
________________________________________
6.17 Anti-Patterns
The following practices are prohibited.
•	FLOAT for money.
•	INTEGER for invoice numbers.
•	TEXT for every column.
•	VARCHAR without business justification.
•	Storing dates as text.
•	Storing numbers as text.
•	Multiple values in one column.
•	JSON replacing relational design.
________________________________________
6.18 Summary
Selecting consistent data types ensures correctness, maintainability, and long-term scalability.
These standards shall apply uniformly across every ERP module.
________________________________________
Chapter 7
Primary Key Strategy
________________________________________
7.1 Introduction
Every business entity stored within the ERP must be uniquely identifiable throughout its entire lifecycle.
The choice of primary key affects:
•	Scalability.
•	Security.
•	Integration.
•	Synchronization.
•	Performance.
•	Maintainability.
Accordingly, the ERP adopts a standardized primary key strategy.
________________________________________
7.2 Objectives
The primary key strategy is intended to provide:
•	Global uniqueness.
•	Stable references.
•	Technology independence.
•	Secure external APIs.
•	Future distributed system compatibility.
________________________________________
7.3 Primary Key Standard
Every business table shall contain a single primary key.
Column name:
id
Data type:
UUID
This standard applies to all master, transaction, configuration, and platform tables unless explicitly exempted.
________________________________________
7.4 Why UUID?
Traditional integer identifiers expose implementation details.
Example
Customer IDs
1
2
3
4
An external user immediately knows:
•	Number of records.
•	Growth rate.
•	Record ordering.
UUID eliminates this information.
Example
550e8400-e29b-41d4-a716-446655440000
This identifier reveals nothing about business volume or sequence.
________________________________________
7.5 Advantages
Using UUID provides:
Security
Identifiers cannot be guessed easily.
________________________________________
Distributed Systems
Future services can generate identifiers independently.
________________________________________
Offline Capability
Client applications may create temporary entities before synchronization.
________________________________________
Easier Integration
External systems need not coordinate identifier ranges.
________________________________________
Stable APIs
Public APIs remain independent of database implementation.
________________________________________
7.6 Internal Codes vs Primary Keys
Business identifiers should not be confused with database identifiers.
Example
Customer
Database Identifier
id
Business Identifier
customer_code
Users interact with customer codes.
The database uses UUID internally.
________________________________________
7.7 Composite Primary Keys
Composite primary keys are prohibited unless explicitly approved.
Reasons include:
•	Increased complexity.
•	More difficult foreign keys.
•	Harder ORM support.
•	Reduced readability.
Composite uniqueness should instead be implemented through UNIQUE constraints.
________________________________________
7.8 Natural Keys
Natural business identifiers shall not be used as primary keys.
Examples:
•	GST Number
•	Email Address
•	PAN
•	Aadhaar
•	Phone Number
Business identifiers may change.
Primary keys must remain immutable.
________________________________________
7.9 Immutability
Once assigned, a primary key shall never change.
Updating primary keys is prohibited.
Historical relationships depend upon identifier stability.
________________________________________
7.10 Foreign Key References
Every relationship between tables shall reference the UUID primary key.
Example
Sales Invoice
customer_id
references
Customer
id
Business codes shall not be used as relational identifiers.
________________________________________
7.11 Public APIs
REST APIs shall expose UUID identifiers.
Example
GET /customers/550e8400-e29b-41d4-a716-446655440000
rather than
GET /customers/123
This provides stable, globally unique resource identifiers.
________________________________________
7.12 Import & Migration
During data migration, original business codes may be preserved.
However, new UUID identifiers shall still be generated for internal relationships unless migration requirements dictate otherwise.
________________________________________
7.13 Anti-Patterns
The following practices are prohibited.
•	Auto-increment primary keys for business entities.
•	Composite primary keys.
•	Mutable primary keys.
•	Business codes as primary keys.
•	Reusing deleted identifiers.
________________________________________
7.14 Summary
The Enterprise ERP Platform adopts UUID as the universal primary key strategy.
This decision provides a secure, scalable, and future-proof identification mechanism suitable for enterprise deployments, distributed architectures, and long-term system evolution.
The next chapter builds upon this strategy by defining how primary keys are referenced throughout the database using standardized foreign key relationships.
---

Chapter 8
Foreign Key Standards & Referential Integrity
________________________________________
8.1 Introduction
A relational database derives its strength from the relationships established between business entities. These relationships ensure that data remains accurate, consistent, and meaningful throughout the lifecycle of the ERP.
Foreign keys are the primary mechanism by which these relationships are enforced.
Without proper foreign key constraints, invalid references, orphaned records, duplicate relationships, and inconsistent business information can occur.
For this reason, foreign key standards are mandatory throughout the Enterprise ERP Platform.
________________________________________
8.2 Objectives
The foreign key strategy is designed to:
•	Preserve referential integrity.
•	Prevent orphan records.
•	Ensure business consistency.
•	Simplify application development.
•	Improve query optimization.
•	Enable reliable reporting.
•	Support modular architecture.
________________________________________
8.3 Definition
A foreign key is a column that references the primary key of another table.
Example:
Customer
---------
id
Sales Invoice
-------------
customer_id
The database guarantees that every customer_id stored within the Sales Invoice table refers to an existing Customer.
________________________________________
8.4 Naming Standard
Foreign key columns shall use the following convention:
<referenced_table>_id
Examples:
organization_id
branch_id
customer_id
supplier_id
warehouse_id
employee_id
currency_id
financial_year_id
tax_group_id
No alternative naming styles are permitted.
________________________________________
8.5 Mandatory Relationships
Every business relationship shall be represented by a foreign key whenever practical.
Examples include:
Sales Invoice
•	Customer
•	Branch
•	Organization
•	Financial Year
•	Currency
Purchase Order
•	Supplier
•	Warehouse
•	Organization
Employee
•	Department
•	Designation
•	Branch
Explicit relationships improve both data integrity and developer understanding.
________________________________________
8.6 Referential Integrity
The database—not the application—shall enforce referential integrity.
Application code may perform validation for user experience, but the database remains the final authority.
No record shall reference a non-existent parent.
________________________________________
8.7 Cascade Rules
The use of cascading actions shall be conservative.
ON DELETE CASCADE
Permitted only where child records have no meaning without the parent.
Example:
Sales Invoice
↓
Sales Invoice Line
Deleting the invoice should remove its line items if the business process permits deletion.
________________________________________
ON DELETE RESTRICT
Preferred for most business entities.
Example:
Customer
↓
Sales Invoice
A customer with historical invoices must not be deleted.
________________________________________
ON DELETE SET NULL
Appropriate only when the relationship is optional.
Example:
Employee
↓
Manager
If the manager leaves the organization, subordinate employees may temporarily have no assigned manager.
________________________________________
8.8 Optional Relationships
Not every foreign key is mandatory.
Examples:
•	Secondary Contact
•	Referring Employee
•	Optional Salesperson
•	Optional Carrier
Optional relationships shall allow NULL values.
________________________________________
8.9 Circular Dependencies
Circular foreign key relationships are prohibited.
Example:
A references B
↓
B references A
Such structures complicate insertion, deletion, migrations, and testing.
Business processes should be redesigned to avoid circular dependencies.
________________________________________
8.10 Foreign Keys and Soft Deletes
A soft-deleted parent record shall continue to satisfy foreign key constraints.
Historical transactions remain valid even if the associated master record is marked as inactive or deleted.
Business rules—not referential integrity—determine whether new transactions may reference inactive entities.
________________________________________
8.11 Performance Considerations
Every foreign key should normally have a corresponding index.
Benefits include:
•	Faster joins.
•	Improved filtering.
•	Better reporting performance.
•	Faster integrity checks.
Indexes are discussed further in Chapter 17.
________________________________________
8.12 Cross-Module References
Foreign keys establish relationships between modules without transferring ownership.
Example:
Sales Invoice
↓
Customer
Customer ownership remains with the Customer Management module, as defined in Chapter 3.
________________________________________
8.13 Self-Referencing Relationships
Some entities naturally reference themselves.
Examples:
Employee
↓
Manager
Category
↓
Parent Category
Account
↓
Parent Account
These relationships are acceptable when they model genuine business hierarchies.
________________________________________
8.14 Historical Records
Historical transactions shall continue referencing their original master records.
Master records should therefore be archived rather than physically deleted.
This principle preserves auditability and financial accuracy.
________________________________________
8.15 Anti-Patterns
The following practices are prohibited:
•	Storing foreign identifiers without constraints.
•	Using business codes instead of UUID references.
•	Circular dependencies.
•	Deleting parent records referenced by historical transactions.
•	Replacing foreign keys with free-text values.
________________________________________
8.16 Summary
Foreign keys form the structural foundation of the ERP database.
Properly implemented referential integrity guarantees that relationships remain valid, reliable, and enforceable throughout the lifecycle of the platform.
________________________________________
Chapter 9
Audit Columns & Record Lifecycle
________________________________________
9.1 Introduction
Business data changes continuously throughout the operation of an ERP system.
Without historical tracking, it becomes impossible to determine:
•	Who created a record.
•	When it was modified.
•	Who approved it.
•	Whether it has been deleted.
•	Which version is current.
To address these requirements, every business table shall include a standardized set of audit columns.
These audit columns provide traceability, accountability, and regulatory compliance.
________________________________________
9.2 Objectives
The audit framework aims to:
•	Record data history.
•	Improve accountability.
•	Support regulatory requirements.
•	Simplify troubleshooting.
•	Enable historical reporting.
•	Support future workflow automation.
________________________________________
9.3 Mandatory Audit Columns
Unless explicitly exempted, every business table shall include the following columns.
Column	Type	Description
created_at	TIMESTAMPTZ	Record creation timestamp
created_by	UUID	User who created the record
updated_at	TIMESTAMPTZ	Last modification timestamp
updated_by	UUID	User who last modified the record
is_deleted	BOOLEAN	Soft delete indicator
deleted_at	TIMESTAMPTZ	Deletion timestamp
deleted_by	UUID	User performing deletion
These columns establish the minimum audit standard.
________________________________________
9.4 Creation Audit
When a record is first created:
•	created_at shall contain the current timestamp.
•	created_by shall contain the authenticated user.
These values shall never be modified afterwards.
________________________________________
9.5 Update Audit
Whenever business information changes:
•	updated_at shall be refreshed.
•	updated_by shall be updated.
If no business attributes change, these values should remain unchanged.
________________________________________
9.6 Deletion Audit
The ERP adopts a soft delete strategy for most business entities (defined in Chapter 10).
Deletion consists of:
is_deleted = TRUE
deleted_at = Current Timestamp
deleted_by = Current User
Physical deletion should remain exceptional.
________________________________________
9.7 User References
Audit user references shall point to the User table using foreign keys.
created_by ↓ user.id
updated_by ↓ user.id
deleted_by ↓ user.id
This enables complete accountability throughout the ERP.
________________________________________
9.8 Business Lifecycle Columns
Certain entities require additional lifecycle tracking.
Examples include:
approved_at
approved_by
posted_at
posted_by
cancelled_at
cancelled_by
closed_at
closed_by
These columns should be introduced only where supported by the business process.
________________________________________
9.9 Version Columns
Business entities requiring optimistic concurrency shall include:
version_number
This value increments whenever the record changes.
Versioning strategies are discussed further in Chapter 11.
________________________________________
9.10 Immutable Historical Information
Audit information shall never be rewritten.
Example:
Changing created_at after record creation is prohibited.
Similarly:
•	created_by
•	deleted_at
•	deleted_by
must accurately represent historical events.
________________________________________
9.11 Automated Population
Audit fields should be populated automatically by backend services.
Frontend applications shall not supply audit information directly.
The backend is responsible for:
•	Authentication.
•	User identification.
•	Timestamp generation.
•	Authorization.
This maintains consistency across all client applications.
________________________________________
9.12 Reporting Benefits
Standard audit columns simplify reporting.
Examples include:
•	Records created today.
•	Records modified this month.
•	User activity reports.
•	Deletion history.
•	Operational dashboards.
Consistent audit structures reduce report complexity.
________________________________________
9.13 Compliance
Many industries require complete audit trails.
Examples include:
•	Financial Accounting
•	Manufacturing
•	Healthcare
•	Government
•	Logistics
Standard audit fields assist organizations in meeting internal governance and external regulatory requirements.
________________________________________
9.14 Exceptions
Reference tables that never change may be exempt from some audit requirements.
Examples include:
•	Country
•	Currency
•	Language
Such exceptions must be documented.
________________________________________
9.15 Anti-Patterns
The following practices are prohibited:
•	Missing audit fields.
•	Allowing clients to set created_by.
•	Updating created_at.
•	Hard deleting business records without approval.
•	Storing usernames instead of user identifiers.
________________________________________
9.16 Summary
Audit columns provide a standardized mechanism for tracking the complete lifecycle of business records.
Every module within the ERP shall implement the audit framework consistently, ensuring traceability, accountability, and reliable historical reporting.
The next chapter introduces the platform-wide strategy for soft deletion, archival, and long-term data retention.
End of Volume 2 — Chapters 8 & 9
Enterprise ERP Software Architecture Document
Volume 2 — Database Architecture & Standards
Version: 1.0
Part II — Database Standards
________________________________________
Chapter 10
Soft Delete Strategy & Data Retention
________________________________________
10.1 Introduction
Enterprise Resource Planning (ERP) systems manage business information that often has legal, financial, contractual, and operational significance. Unlike consumer applications, business records cannot simply be removed because a user chooses to delete them.
Invoices, purchase orders, payments, inventory transactions, payroll records, and audit logs frequently require long-term retention for statutory compliance, auditing, taxation, and historical reporting.
For this reason, the Enterprise ERP Platform adopts Soft Delete as the default deletion strategy.
Physical deletion shall be considered an exceptional administrative operation rather than standard business functionality.
________________________________________
10.2 Objectives
The Soft Delete Strategy has the following objectives:
•	Preserve historical business information.
•	Prevent accidental data loss.
•	Support auditing and regulatory compliance.
•	Maintain referential integrity.
•	Enable record restoration.
•	Improve disaster recovery.
•	Preserve historical reports.
________________________________________
10.3 Definitions
Soft Delete
A record remains physically stored within the database but is marked as deleted through audit columns (is_deleted, deleted_at, deleted_by from Chapter 9).
Example:
is_deleted = TRUE
deleted_at = 2026-08-05 10:30 UTC
deleted_by = User UUID
The record continues to exist and can be restored if necessary.
________________________________________
Hard Delete
A record is permanently removed from the database.
Once deleted, recovery requires database backups.
Hard deletion should occur only under controlled administrative procedures.
________________________________________
10.4 Business Rules
When a record is deleted:
•	is_deleted shall be set to TRUE.
•	deleted_at shall contain the current timestamp.
•	deleted_by shall contain the authenticated user.
No additional modifications shall occur unless required by the business process.
________________________________________
10.5 Visibility Rules
By default, business queries shall exclude soft-deleted records.
Unless explicitly requested, application services should return only:
is_deleted = FALSE
Administrative screens may optionally provide filters to display deleted records.
________________________________________
10.6 Restoration
Soft-deleted records may be restored when business rules permit.
Restoration consists of:
•	Setting is_deleted to FALSE.
•	Clearing deleted_at.
•	Clearing deleted_by.
The restoration event itself should be recorded within the audit log.
________________________________________
10.7 Restrictions
Certain records shall never be deleted, even through soft delete, after reaching specific lifecycle states.
Examples include:
•	Posted Journal Entries
•	Filed Tax Returns
•	Closed Financial Years
•	Approved Payroll Runs
•	Submitted Regulatory Reports
Instead of deletion, these records may support reversal or cancellation workflows.
________________________________________
10.8 Referential Integrity
Soft deletion shall not violate foreign key relationships.
Historical child records must continue referencing their original parent records.
Example:
Customer
↓
Sales Invoice
Even if a customer becomes inactive or is soft deleted, historical invoices remain valid.
________________________________________
10.9 User Experience
Applications should communicate deletion status clearly.
Examples:
•	Display "Inactive" badges.
•	Show deletion timestamp in administrative views.
•	Prevent new transactions against deleted master records.
•	Allow authorized restoration where appropriate.
________________________________________
10.10 Retention Policy
Organizations may define retention periods according to business requirements.
Illustrative examples:
Record Type	Suggested Retention
Audit Logs	7–10 Years
Financial Transactions	Permanent or Statutory Requirement
Employee Records	According to Employment Law
Import Logs	1–3 Years
Temporary Data	30–90 Days
Actual retention periods shall comply with applicable legal and organizational requirements.
________________________________________
10.11 Administrative Purge
Permanent deletion shall be performed only through controlled maintenance procedures.
Administrative purge operations should:
•	Require elevated privileges.
•	Generate audit records.
•	Produce backup recommendations.
•	Validate referential dependencies before execution.
________________________________________
10.12 Benefits
Adopting soft deletion provides:
•	Better auditing.
•	Improved recoverability.
•	Consistent reporting.
•	Stronger compliance.
•	Safer business operations.
________________________________________
10.13 Anti-Patterns
The following practices are prohibited:
•	Executing unrestricted DELETE statements from application code.
•	Removing master records referenced by transactions.
•	Reusing deleted business codes without defined rules.
•	Ignoring audit columns during deletion.
________________________________________
10.14 Summary
Soft deletion provides a safe and controlled mechanism for handling business record removal while preserving historical integrity and regulatory compliance.
Unless explicitly exempted, every business entity within the ERP shall follow the standards defined in this chapter.
________________________________________
Chapter 11
Record Versioning & Optimistic Concurrency
________________________________________
11.1 Introduction
In a multi-user ERP environment, multiple users may attempt to update the same business record simultaneously.
Without proper concurrency control, one user's changes may unintentionally overwrite another's work, resulting in data inconsistency and business errors.
To prevent these conflicts, the Enterprise ERP Platform adopts a standardized record versioning strategy based on optimistic concurrency control.
________________________________________
11.2 Objectives
The versioning framework aims to:
•	Prevent lost updates.
•	Detect concurrent modifications.
•	Improve data consistency.
•	Support distributed applications.
•	Simplify API behavior.
•	Enable future synchronization scenarios.
________________________________________
11.3 Optimistic Concurrency
The ERP assumes that conflicting updates are relatively uncommon.
Instead of locking records for extended periods, each update verifies that the record has not changed since it was retrieved.
If another modification has occurred, the update is rejected and the user is informed.
This approach provides excellent scalability for enterprise applications.
________________________________________
11.4 Version Column
Every mutable business table shall include the following column:
Column	Type	Purpose
version_number	INTEGER	Current record version
The initial value shall be:
1
Each successful update increments the version by one.
________________________________________
11.5 Update Workflow
Typical update sequence:
1.	Client retrieves the record.
2.	Client receives version_number = 5.
3.	User edits the record.
4.	Update request includes version 5.
5.	Database verifies current version.
6.	If version matches:
o	Update succeeds.
o	Version becomes 6.
7.	If version differs:
o	Update is rejected.
o	User reloads the latest data.
________________________________________
11.6 Conflict Detection
When a version mismatch occurs, the backend shall return a standardized concurrency error.
The application should inform the user that another modification has already been applied.
Conflict resolution should never silently overwrite newer information.
________________________________________
11.7 Relationship with Audit Columns
Each successful update shall perform the following actions simultaneously:
•	Increment version_number.
•	Update updated_at (from Chapter 9).
•	Update updated_by (from Chapter 9).
These operations shall occur within a single database transaction.
________________________________________
11.8 API Requirements
Every update endpoint shall require the client to provide the current version number.
Illustrative request:
PUT /customers/{id}
version_number: 8
Requests without version information should be rejected unless explicitly exempted.
________________________________________
11.9 Bulk Operations
Bulk updates require special consideration.
Depending on the business process, the system may:
•	Validate each record individually.
•	Reject conflicting records.
•	Continue processing unaffected records.
•	Generate a summary of successful and failed updates.
Bulk operations shall never bypass concurrency controls.
________________________________________
11.10 Immutable Records
Certain records become immutable after reaching specific lifecycle stages.
Examples include:
•	Posted Journal Entries.
•	Approved Payroll.
•	Closed Financial Years.
•	Finalized Tax Returns.
Such records shall reject updates regardless of version.
Corrections shall occur through reversal or adjustment transactions.
________________________________________
11.11 Versioning and Integrations
External integrations shall also participate in optimistic concurrency.
Integration services must retrieve the current version before submitting updates.
This ensures consistent behavior across:
•	Web Applications.
•	Mobile Applications.
•	Desktop Applications.
•	External APIs.
•	Future AI Agents.
________________________________________
11.12 Performance Considerations
Version checking requires minimal overhead.
The benefits of preventing lost updates significantly outweigh the negligible performance cost associated with maintaining a version column.
________________________________________
11.13 Exceptions
Read-only tables do not require versioning.
Examples include:
•	Country
•	Currency
•	Language
•	Static Configuration Tables
Such exceptions shall be documented.
________________________________________
11.14 Anti-Patterns
The following practices are prohibited:
•	Overwriting records without version validation.
•	Resetting version numbers.
•	Allowing clients to modify version values directly.
•	Ignoring concurrency conflicts.
•	Disabling version checks to simplify application logic.
________________________________________
11.15 Future Extensions
The versioning framework may later support:
•	Offline synchronization.
•	Conflict resolution workflows.
•	Change history visualization.
•	Event sourcing integrations.
•	Distributed microservices.
The current strategy provides a solid foundation for these future capabilities.
________________________________________
11.16 Summary
Record versioning is essential for ensuring safe concurrent updates in a multi-user ERP system.
By adopting optimistic concurrency with standardized version numbers, the platform minimizes data conflicts while maintaining excellent performance and scalability.
This concludes Part II – Database Standards.
The following part of Volume 2 transitions from database standards to the architectural design of the multi-tenant database itself, beginning with the tenant model, organizational isolation, and data partitioning strategy.
End of Volume 2 — Chapters 10 & 11
Enterprise ERP Software Architecture Document
Volume 2 — Database Architecture & Standards
Version: 1.0
Part III — Multi-Tenant Database Architecture
________________________________________
Chapter 12
Multi-Tenant Architecture
________________________________________
12.1 Introduction
One of the most fundamental architectural decisions of an Enterprise Resource Planning (ERP) platform is how business data belonging to different organizations is stored and isolated.
The Enterprise ERP Platform is designed as a Software-as-a-Service (SaaS) application capable of serving multiple independent organizations from a single application deployment and a shared PostgreSQL database.
This architectural model is known as a Shared Database, Shared Schema Multi-Tenant Architecture.
Each organization (tenant) operates independently while sharing the same application infrastructure. The platform ensures that data belonging to one tenant remains completely isolated from every other tenant through strict database design, backend enforcement, and role-based access controls.
________________________________________
12.2 Objectives
The multi-tenant architecture has the following objectives:
•	Support thousands of independent organizations.
•	Minimize infrastructure costs.
•	Simplify software deployment.
•	Centralize maintenance.
•	Enable rapid onboarding of new tenants.
•	Preserve complete data isolation.
•	Support future horizontal scaling.
________________________________________
12.3 Definition of a Tenant
Within the ERP, a tenant represents an independent business entity using the platform.
A tenant may be:
•	A Company
•	A Partnership
•	A Sole Proprietorship
•	A Trust
•	A Non-Governmental Organization (NGO)
•	An Educational Institution
•	A Government Department
•	Any legally independent business entity
Each tenant owns its business data while sharing the common ERP platform.
________________________________________
12.4 Architecture Model
The ERP adopts the following architecture:
                    ERP Platform
                         │
        ┌────────────────┼────────────────┐
        │                │                │
   Organization A   Organization B   Organization C
        │                │                │
        └──────────── Shared PostgreSQL ────────────┘
Only one database instance is required.
Every tenant's data is separated logically rather than physically.
________________________________________
12.5 Tenant Identifier
Every tenant shall be uniquely identified by:
organization_id
This identifier shall be of type:
UUID
The organization table acts as the root entity for tenant isolation.
________________________________________
12.6 Tenant-Owned Tables
Every business table containing tenant-specific information shall include:
organization_id
Examples include:
•	Customer
•	Supplier
•	Employee
•	Warehouse
•	Sales Invoice
•	Purchase Order
•	Ledger
•	Payroll
•	Manufacturing Order
This column is mandatory unless the table is explicitly designated as a shared platform table.
________________________________________
12.7 Shared Platform Tables
Certain tables exist independently of any tenant.
Examples include:
•	country
•	currency
•	language
•	timezone
•	module_definition
•	subscription_plan
These tables are maintained by the platform and are shared across all organizations.
Shared tables shall not include organization_id.
________________________________________
12.8 Tenant Isolation
The platform guarantees that one tenant cannot access another tenant's information.
Isolation is enforced through multiple layers:
Database Design
Every tenant-owned record contains organization_id.
Backend Services
Every query automatically filters by the authenticated tenant.
Authorization
Users cannot access data belonging to another organization.
API Layer
Requests are validated before database access.
Isolation shall never rely solely on frontend behavior.
________________________________________
12.9 Backend Enforcement
Tenant filtering shall always be applied by backend services.
Illustrative query:
SELECT *
FROM customer
WHERE organization_id = :currentOrganizationId;
Application developers shall never expose unrestricted tenant queries.
________________________________________
12.10 Tenant Context
Every authenticated request shall operate within a tenant context.
The backend shall determine:
•	Organization
•	Branch
•	Financial Year
•	User
•	Permissions
This context shall be established immediately after successful authentication and remain valid for the duration of the request.
________________________________________
12.11 Benefits
The chosen architecture provides several advantages:
Reduced Cost
One infrastructure serves many organizations.
Simplified Deployment
Platform upgrades are performed once.
Centralized Monitoring
Operations teams manage a single platform.
Consistent Features
Every tenant runs the same software version.
Efficient Resource Utilization
Database resources are shared effectively.
________________________________________
12.12 Challenges
Multi-tenancy also introduces challenges.
These include:
•	Data isolation.
•	Performance balancing.
•	Tenant-specific customization.
•	Large data volumes.
•	Backup strategies.
These challenges are addressed throughout subsequent chapters.
________________________________________
12.13 Security Considerations
Tenant isolation is a security requirement rather than merely a convenience.
Accidental cross-tenant data exposure is considered a critical security incident.
Accordingly:
•	Every backend service shall validate tenant context.
•	Administrative APIs shall undergo additional review.
•	Integration services shall preserve tenant boundaries.
•	Automated tests shall verify tenant isolation.
________________________________________
12.14 Future Scalability
The architecture supports future expansion, including:
•	Read replicas.
•	Database partitioning.
•	Multi-region deployments.
•	Tenant migration.
•	Dedicated databases for very large customers.
The logical design established today shall remain compatible with these future enhancements.
________________________________________
12.15 Summary
The Enterprise ERP Platform adopts a shared database, shared schema multi-tenant architecture.
This model provides excellent scalability, reduced operational cost, simplified maintenance, and strong logical separation of organizational data while remaining flexible enough to support future growth.
________________________________________
Chapter 13
Organization, Branch & Financial Year Isolation
________________________________________
13.1 Introduction
Within a tenant, business operations are frequently divided into multiple organizational units.
Examples include:
•	Branches
•	Warehouses
•	Manufacturing Plants
•	Sales Offices
•	Service Centers
Additionally, financial reporting is typically organized according to financial years.
The ERP therefore introduces multiple layers of logical isolation beyond the tenant itself.
________________________________________
13.2 Hierarchical Structure
The ERP organizes business information according to the following hierarchy:
Platform
    │
Organization
    │
Branch
    │
Financial Year
    │
Business Transactions
Every transactional record exists within this hierarchy.
________________________________________
13.3 Organization
The Organization represents the legal business entity.
Examples include:
•	ABC Industries Pvt. Ltd.
•	XYZ Traders
•	Global Manufacturing Ltd.
The organization owns:
•	Customers
•	Suppliers
•	Employees
•	Financial Data
•	Inventory
•	Configuration
Every tenant has exactly one organization record.
________________________________________
13.4 Branch
Branches represent operational divisions within an organization.
Examples:
•	Mumbai Branch
•	Pune Branch
•	Delhi Branch
Branches may maintain:
•	Independent inventory.
•	Employees.
•	Cash books.
•	Warehouses.
•	Sales teams.
Branch isolation simplifies operational reporting.
________________________________________
13.5 Financial Year
Every transaction shall belong to a financial year.
Examples:
2025–2026
2026–2027
Financial year assignment enables:
•	Period closing.
•	Balance carry-forward.
•	Regulatory reporting.
•	Historical analysis.
Closed financial years should prevent unauthorized modifications.
________________________________________
13.6 Mandatory References
Most transactional tables shall contain the following identifiers:
organization_id
branch_id
financial_year_id
These references provide the minimum context required for business operations.
________________________________________
13.7 Master Data
Master data generally belongs to an organization.
Examples include:
•	Customer
•	Supplier
•	Product
•	Employee
Depending on business requirements, master records may optionally be associated with a branch.
For example:
•	Branch-specific warehouse.
•	Branch-specific cash account.
•	Branch-specific pricing.
________________________________________
13.8 Transaction Data
Every transaction shall belong to:
•	One organization.
•	One branch.
•	One financial year.
Examples:
Sales Invoice
↓
Organization
↓
Branch
↓
Financial Year
This relationship simplifies reporting and auditing.
________________________________________
13.9 Reporting
The hierarchy enables reporting at multiple levels.
Examples:
Organization-wide Sales
Branch-wise Profit
Financial Year Comparison
Monthly Branch Performance
Cross-branch Inventory
These reports can be generated efficiently because every transaction contains standardized references.
________________________________________
13.10 Branch Transfers
Business processes involving multiple branches shall preserve ownership of each transaction.
Examples include:
•	Stock Transfers.
•	Inter-Branch Billing.
•	Asset Transfers.
Each participating branch shall maintain its own transaction records where appropriate, ensuring complete traceability.
________________________________________
13.11 Financial Year Closure
Once a financial year is officially closed:
•	New transactions shall be prohibited.
•	Existing posted transactions become read-only.
•	Adjustment entries require special authorization.
•	Closing balances shall be carried forward according to accounting rules.
This preserves the integrity of historical financial information.
________________________________________
13.12 Security
Users shall operate only within branches and financial years to which they have been granted access.
Examples:
A warehouse manager may access only:
•	Assigned Branch.
•	Current Financial Year.
A finance administrator may access:
•	Multiple Branches.
•	Historical Financial Years.
Permissions are enforced through Role-Based Access Control (RBAC).
________________________________________
13.13 Future Expansion
The organizational hierarchy supports future enhancements, including:
•	Divisions.
•	Business Units.
•	Cost Centers.
•	Profit Centers.
•	Regional Offices.
•	International Subsidiaries.
These additional structures can be incorporated without redesigning the existing hierarchy.
________________________________________
13.14 Summary
The Organization–Branch–Financial Year hierarchy forms the operational backbone of the Enterprise ERP Platform.
By ensuring that every transaction is associated with standardized organizational references, the ERP achieves consistent reporting, simplified security, accurate auditing, and scalable business operations.
These standards shall be applied uniformly across all business modules.
End of Volume 2 — Chapters 12 & 13
Enterprise ERP Software Architecture Document
Volume 2 — Database Architecture & Standards
Version: 1.0
Part III — Multi-Tenant Database Architecture
________________________________________
Chapter 14
Shared Platform Data & Global Reference Tables
________________________________________
14.1 Introduction
Not all data within an ERP system belongs to a specific organization. Certain information is common to every tenant and should exist only once within the platform.
Examples include countries, currencies, languages, time zones, subscription plans, and system modules.
Duplicating such information for every organization increases storage requirements, complicates maintenance, and creates unnecessary inconsistencies.
The Enterprise ERP Platform therefore distinguishes between Tenant Data and Platform Data.
Platform Data is maintained centrally and shared by all organizations.
________________________________________
14.2 Objectives
The Shared Platform Data architecture aims to:
•	Eliminate unnecessary duplication.
•	Ensure consistency across all tenants.
•	Simplify maintenance.
•	Reduce storage requirements.
•	Enable centralized administration.
•	Improve reporting consistency.
________________________________________
14.3 Definition
Platform Data refers to information owned by the ERP platform rather than by an individual organization.
Characteristics include:
•	Common to all tenants.
•	Managed centrally.
•	Rarely modified.
•	Read-only for tenant users.
•	Shared across all modules.
Platform Data represents the foundation upon which tenant-specific business information is built.
________________________________________
14.4 Categories of Platform Data
Platform Data can be broadly classified into the following categories:
Geographic Data
Examples:
•	Country
•	State
•	District
•	City
•	Postal Code
________________________________________
Localization Data
Examples:
•	Language
•	Currency
•	Time Zone
•	Number Format
•	Date Format
________________________________________
Platform Configuration
Examples:
•	Subscription Plans
•	Available Modules
•	License Features
•	Application Settings
________________________________________
Security Reference Data
Examples:
•	Permission Definitions
•	System Roles
•	Authentication Providers
________________________________________
Technical Metadata
Examples:
•	Document Types
•	Notification Templates
•	System Event Types
•	Audit Event Categories
________________________________________
14.5 Characteristics
Platform tables generally exhibit the following characteristics:
•	Small data volume.
•	High read frequency.
•	Very low write frequency.
•	Stable structure.
•	Shared across all organizations.
These characteristics make them excellent candidates for aggressive caching.
________________________________________
14.6 Organization Independence
Platform tables shall not contain:
organization_id
Their contents remain identical regardless of the organization accessing them.
Example:
India exists only once in the database.
Every organization references the same country record.
________________________________________
14.7 Referential Relationships
Tenant-owned tables may reference Platform Data through foreign keys.
Example:
Customer
↓
Country
↓
Currency
↓
Language
Ownership remains with the Platform Core.
Tenant modules consume but do not own these records.
________________________________________
14.8 Modification Rules
Platform Data may only be modified by:
•	Platform Administrators.
•	Migration Scripts.
•	Approved Maintenance Utilities.
Regular tenant users shall have read-only access.
________________________________________
14.9 Caching Strategy
Because Platform Data changes infrequently, backend services may safely cache these records.
Typical cache candidates include:
•	Country
•	Currency
•	Language
•	Module Definitions
•	Tax Categories
•	Units of Measure
Caching reduces database load while maintaining consistent behavior.
Cache invalidation procedures shall be documented for any platform table that supports updates.
________________________________________
14.10 Version Management
Changes to Platform Data shall be carefully controlled.
Examples include:
•	Introducing a new currency.
•	Adding a new supported language.
•	Publishing a new ERP module.
•	Updating system permissions.
Such modifications should occur through controlled release procedures rather than ad hoc database changes.
________________________________________
14.11 Examples of Shared Tables
Illustrative shared platform tables include:
Table	Description
country	Supported countries
state	Administrative states or provinces
city	Cities and municipalities
currency	Supported currencies
language	Application languages
timezone	Time zone definitions
module_definition	ERP module catalog
subscription_plan	Subscription offerings
permission_definition	Platform permission catalog
document_type	Standard document classifications
This list is illustrative rather than exhaustive.
________________________________________
14.12 Anti-Patterns
The following practices are prohibited:
•	Creating duplicate platform records for each tenant.
•	Allowing tenant users to modify shared platform data.
•	Introducing tenant-specific customization into platform tables.
•	Storing organization-specific settings in shared reference tables.
________________________________________
14.13 Summary
Shared Platform Data forms the common foundation upon which all tenant-specific business data is built.
Centralizing global reference information improves consistency, reduces duplication, and simplifies long-term maintenance across the ERP platform.
________________________________________
Chapter 15
Master Data Architecture
________________________________________
15.1 Introduction
Master Data represents the core business entities used repeatedly across multiple business processes.
Unlike transactional data, which records individual business events, Master Data describes the people, organizations, products, resources, and assets involved in those events.
A well-designed Master Data architecture is essential for maintaining consistency across the ERP platform.
________________________________________
15.2 Objectives
The Master Data architecture seeks to:
•	Eliminate duplicate business entities.
•	Promote data reuse.
•	Ensure consistency across modules.
•	Simplify reporting.
•	Support business growth.
•	Maintain long-term data quality.
________________________________________
15.3 Definition
Master Data refers to relatively stable business information that is referenced by multiple transactions.
Examples include:
•	Customer
•	Supplier
•	Employee
•	Product
•	Warehouse
•	Asset
Master records are created infrequently but referenced extensively.
________________________________________
15.4 Characteristics
Master Data generally exhibits the following characteristics:
•	Long lifecycle.
•	Frequent reuse.
•	Moderate update frequency.
•	High business importance.
•	Multiple module dependencies.
Because Master Data influences many business processes, modifications should be carefully controlled.
________________________________________
15.5 Categories
Master Data may be grouped into several categories.
Business Partners
Examples:
•	Customer
•	Supplier
•	Distributor
•	Dealer
________________________________________
Human Resources
Examples:
•	Employee
•	Department
•	Designation
•	Shift
________________________________________
Inventory
Examples:
•	Product
•	Item Category
•	Brand
•	Unit of Measure
•	Warehouse
________________________________________
Financial
Examples:
•	Ledger Account
•	Tax Group
•	Payment Terms
•	Bank Account
________________________________________
Assets
Examples:
•	Fixed Asset
•	Machine
•	Vehicle
•	Equipment
________________________________________
15.6 Ownership
Each Master Data entity shall have a single owning module (as defined in Chapter 3).
Examples:
Customer → Customer Management
Supplier → Supplier Management
Product → Inventory
Employee → Human Resources
Ownership shall comply with the Data Ownership principles established in Chapter 3.
________________________________________
15.7 Lifecycle
The lifecycle of a Master Data record typically consists of:
1.	Creation.
2.	Validation.
3.	Approval (if applicable).
4.	Active Use.
5.	Inactivation.
6.	Archival.
Physical deletion should rarely occur.
________________________________________
15.8 Business Codes
Every Master Data entity should possess a human-readable business code in addition to its UUID primary key.
Examples:
Customer Code: CUST-000001
Supplier Code: SUP-000145
Item Code: ITEM-001256
Business codes facilitate communication with users while UUIDs remain the internal identifiers.
________________________________________
15.9 Duplicate Prevention
Master Data should be protected against unintended duplication.
Examples include validating uniqueness for:
•	Customer Code.
•	Supplier Code.
•	Item Code.
•	Employee Number.
•	Warehouse Code.
Additional duplicate detection mechanisms, such as similarity matching, may be introduced in future versions.
________________________________________
15.10 Relationships
Master Data frequently references other Master Data entities through foreign keys (as defined in Chapter 8).
Examples:
Employee → Department → Branch
Customer → Price Group → Currency
Item → Category → Brand → Unit
Such relationships shall be enforced using foreign key constraints.
________________________________________
15.11 Version Control
Critical Master Data should support versioning through the framework defined in Chapter 11.
Versioning enables safe concurrent updates and protects against accidental overwrites.
________________________________________
15.12 Security
Creation and modification of Master Data shall be restricted to authorized users.
Typical permissions include:
•	Create Customer.
•	Edit Supplier.
•	Approve Employee.
•	Archive Product.
Read access may be granted more broadly according to business requirements.
________________________________________
15.13 Reporting
Because Master Data is referenced throughout the ERP, consistency is essential for accurate reporting.
Examples include:
•	Customer Sales Analysis.
•	Supplier Purchase Summary.
•	Inventory by Product Category.
•	Employee Productivity.
Poor Master Data quality directly affects reporting accuracy.
________________________________________
15.14 Future Extensions
The Master Data architecture is designed to accommodate future business entities, including:
•	Service Items.
•	Subscription Products.
•	Projects.
•	Contracts.
•	Equipment.
•	Medical Assets.
•	Educational Resources.
These entities shall follow the same architectural principles defined in this chapter.
________________________________________
15.15 Anti-Patterns
The following practices are prohibited:
•	Duplicating Master Data across modules.
•	Using transaction tables to store reusable business information.
•	Reusing business codes after archival without documented policy.
•	Allowing unrestricted modification of critical Master Data.
________________________________________
15.16 Summary
Master Data forms the backbone of business operations within the ERP platform.
By maintaining a single authoritative representation of each reusable business entity, the platform ensures consistency, improves reporting quality, simplifies maintenance, and supports long-term scalability.
The next chapter concludes the architectural foundation by examining Transaction Data—the business events that drive every operational process within the ERP.
End of Volume 2 — Chapters 14 & 15
Enterprise ERP Software Architecture Document
Volume 2 — Database Architecture & Standards
Version: 1.0
Part III — Multi-Tenant Database Architecture
________________________________________
Chapter 16
Transaction Data Architecture
________________________________________
16.1 Introduction
Transaction Data represents the operational activities performed by an organization during its day-to-day business operations.
Unlike Master Data, which describes reusable business entities, Transaction Data records business events that occur over time.
Examples include:
•	Sales
•	Purchases
•	Payments
•	Receipts
•	Inventory Movements
•	Manufacturing Orders
•	Payroll Processing
•	Journal Entries
Transaction Data forms the operational history of an organization and is among the most valuable information stored within the ERP.
________________________________________
16.2 Objectives
The Transaction Data architecture has the following objectives:
•	Record every business event accurately.
•	Maintain complete historical information.
•	Preserve financial integrity.
•	Support auditing.
•	Enable business analytics.
•	Provide reliable reporting.
________________________________________
16.3 Characteristics
Transaction Data typically exhibits the following characteristics:
•	High insert frequency.
•	Very low deletion frequency.
•	Moderate update frequency before finalization.
•	Permanent historical value.
•	Strong dependency on Master Data.
Unlike Master Data, Transaction Data grows continuously throughout the life of the ERP.
________________________________________
16.4 Categories of Transaction Data
Transaction Data may be grouped into several business domains.
Sales Transactions
Examples:
•	Sales Quotation
•	Sales Order
•	Sales Invoice
•	Sales Return
________________________________________
Purchase Transactions
Examples:
•	Purchase Requisition
•	Purchase Order
•	Purchase Invoice
•	Purchase Return
________________________________________
Inventory Transactions
Examples:
•	Goods Receipt
•	Stock Transfer
•	Inventory Adjustment
•	Physical Stock Verification
________________________________________
Financial Transactions
Examples:
•	Journal Entry
•	Receipt Voucher
•	Payment Voucher
•	Contra Entry
________________________________________
Human Resource Transactions
Examples:
•	Attendance
•	Leave Application
•	Salary Processing
•	Expense Claim
________________________________________
16.5 Header–Detail Structure
Most business transactions shall follow a Header–Detail design.
Example:
Sales Invoice
    │
    ├── Item 1
    ├── Item 2
    ├── Item 3
    └── Item N
The Header contains transaction-level information.
The Detail contains line-level information.
This design minimizes duplication and improves maintainability.
________________________________________
16.6 Mandatory References
Every transaction shall contain, where applicable:
organization_id (tenant reference from Chapter 12)
branch_id (organizational reference from Chapter 13)
financial_year_id (period reference from Chapter 13)
created_by (audit reference from Chapter 9)
created_at (audit timestamp from Chapter 9)
version_number (concurrency control from Chapter 11)
These references establish ownership, auditability, and concurrency control.
________________________________________
16.7 Transaction Status
Every transaction shall progress through a defined lifecycle.
Illustrative states:
Draft
Submitted
Approved
Posted
Closed
Cancelled
The available states depend upon the business module.
State transitions shall be controlled by business rules rather than direct database updates.
________________________________________
16.8 Immutability
Once a transaction reaches a finalized state, direct modification shall be prohibited.
Examples include:
•	Posted Journal Entries.
•	Approved Payroll.
•	Finalized Sales Invoices.
•	Closed Inventory Adjustments.
Corrections shall be performed through reversal, cancellation, or adjustment transactions.
This approach preserves complete business history (as defined in Chapter 2.6).
________________________________________
16.9 Document Numbering
Every transaction shall possess two identifiers:
Internal Identifier: UUID
Business Identifier: Invoice Number, PO Number, Voucher Number
Business document numbers shall be generated according to the numbering strategy defined elsewhere in this architecture.
________________________________________
16.10 Relationships
Transaction records shall reference Master Data through foreign keys (as defined in Chapter 8).
Example:
Sales Invoice
↓
Customer
↓
Salesperson
↓
Currency
↓
Warehouse
↓
Tax Group
This ensures data consistency across all modules.
________________________________________
16.11 Historical Accuracy
Historical transactions shall preserve the business state that existed at the time of the event.
Example:
Changing a customer's address today shall not alter historical invoices issued previously.
Where appropriate, transactional snapshots may be stored to preserve historical accuracy.
________________________________________
16.12 Auditability
Every transaction shall support:
•	Audit columns (Chapter 9).
•	Version control (Chapter 11).
•	Status history.
•	Approval tracking.
•	Change logging.
These mechanisms provide complete traceability throughout the transaction lifecycle.
________________________________________
16.13 Reporting
Transaction Data supports operational and analytical reporting.
Examples include:
•	Daily Sales.
•	Monthly Purchases.
•	Inventory Movement.
•	Profit Analysis.
•	Cash Flow.
•	Payroll Summary.
Consistent transaction design simplifies report generation across modules.
________________________________________
16.14 Anti-Patterns
The following practices are prohibited:
•	Modifying finalized transactions.
•	Reusing transaction numbers.
•	Storing line items within header records.
•	Deleting historical financial transactions.
•	Omitting audit information.
________________________________________
16.15 Summary
Transaction Data captures the operational activities of an organization.
By adopting standardized structures, lifecycle management, and immutable historical records, the ERP ensures reliable operations, accurate reporting, and long-term business integrity.
________________________________________
Chapter 17
Indexing Strategy & Query Performance
________________________________________
17.1 Introduction
As the ERP grows, database tables will eventually contain millions of records.
Without an effective indexing strategy, query performance deteriorates rapidly, resulting in slow application response times, inefficient reporting, and increased infrastructure costs.
Indexes are therefore a critical component of the database architecture.
This chapter defines the standard indexing strategy adopted throughout the Enterprise ERP Platform.
________________________________________
17.2 Objectives
The indexing strategy aims to:
•	Improve query performance.
•	Reduce response times.
•	Optimize reporting.
•	Support scalability.
•	Minimize unnecessary indexes.
•	Balance read and write performance.
________________________________________
17.3 What is an Index?
An index is a specialized database structure that allows PostgreSQL to locate records efficiently without scanning the entire table.
Illustrative example:
Without Index
1,000,000 Rows → Sequential Scan
With Index
Index Lookup → Target Record
Indexes significantly reduce the time required to retrieve frequently accessed information.
________________________________________
17.4 Primary Key Indexes
Every primary key automatically creates a unique index.
Example:
PRIMARY KEY (id)
No additional index on the primary key is required.
________________________________________
17.5 Foreign Key Indexes
Every foreign key should normally have a corresponding index.
Examples:
organization_id
customer_id
supplier_id
branch_id
warehouse_id
Foreign key indexes improve joins and filtering performance.
________________________________________
17.6 Composite Indexes
Frequently combined search conditions should use composite indexes.
Example:
organization_id, branch_id, invoice_date
Rather than creating three independent indexes, a composite index may better support common reporting queries.
Index design shall be driven by actual query patterns.
________________________________________
17.7 Unique Indexes
Unique indexes shall enforce business uniqueness.
Examples include:
•	Customer Code.
•	Supplier Code.
•	Employee Number.
•	Item Barcode.
•	Username.
Uniqueness constraints help maintain data quality.
________________________________________
17.8 Partial Indexes
PostgreSQL supports partial indexes that include only selected rows.
Example:
WHERE is_deleted = FALSE
This improves performance for active records while reducing index size.
Partial indexes are particularly valuable in systems that extensively use soft deletion (Chapter 10).
________________________________________
17.9 Covering Indexes
Where supported, indexes may include additional columns required by frequently executed queries.
Covering indexes reduce table lookups and improve performance for read-intensive workloads.
Their use should be based on performance analysis rather than assumption.
________________________________________
17.10 Over-Indexing
Excessive indexing increases:
•	Storage consumption.
•	Insert cost.
•	Update cost.
•	Maintenance overhead.
Every additional index must provide measurable value.
Indexes shall not be created without justification.
________________________________________
17.11 Reporting Indexes
Analytical reports often require specialized indexes.
Examples:
•	Transaction Date.
•	Financial Year.
•	Branch.
•	Customer.
•	Product Category.
Reporting indexes shall be evaluated using production query statistics.
________________________________________
17.12 Monitoring
Database performance shall be monitored regularly.
Metrics include:
•	Slow queries.
•	Index usage.
•	Sequential scans.
•	Cache hit ratio.
•	Query execution plans.
Indexes should evolve according to observed workload.
________________________________________
17.13 Maintenance
Indexes require periodic maintenance.
Recommended activities include:
•	REINDEX (when appropriate).
•	Statistics updates.
•	Bloat monitoring.
•	Query optimization.
•	Removal of unused indexes.
Maintenance procedures shall be incorporated into database administration schedules.
________________________________________
17.14 Anti-Patterns
The following practices are prohibited:
•	Indexing every column.
•	Creating duplicate indexes.
•	Ignoring slow query analysis.
•	Assuming indexes always improve performance.
•	Maintaining obsolete indexes.
________________________________________
17.15 Summary
Indexes are fundamental to database performance.
A carefully designed indexing strategy balances read performance, write performance, storage utilization, and maintainability.
The ERP shall continuously monitor and refine its indexing strategy as usage patterns evolve.

---

Chapter 18
Database Constraints & Business Rule Enforcement
________________________________________
18.1 Introduction
A database is not merely a storage system—it is the final authority responsible for maintaining data integrity.
While application services perform validation to provide immediate user feedback, the database shall independently enforce all fundamental integrity rules.
Business rules that protect the consistency of the ERP must never rely solely on frontend or backend implementations.
This layered approach ensures that regardless of how data enters the system—through web applications, mobile applications, APIs, integrations, imports, or administrative tools—the database remains the ultimate guardian of data quality.
________________________________________
18.2 Objectives
The database constraint strategy aims to:
•	Preserve data integrity.
•	Prevent invalid business data.
•	Ensure consistent relationships.
•	Reduce application complexity.
•	Improve system reliability.
•	Support regulatory compliance.
________________________________________
18.3 Constraint Types
The Enterprise ERP Platform recognizes the following categories of database constraints.
Constraint Type	Purpose
PRIMARY KEY	Uniquely identifies each record
FOREIGN KEY	Maintains referential integrity (Chapter 8)
UNIQUE	Prevents duplicate values
CHECK	Validates business rules
NOT NULL	Requires mandatory information
DEFAULT	Assigns predefined values
EXCLUSION (where applicable)	Prevents conflicting ranges or intervals
Each constraint serves a distinct purpose and shall be applied appropriately.
________________________________________
18.4 NOT NULL Constraints
Mandatory business information shall always use NOT NULL.
Examples include:
•	Organization ID
•	Created At
•	Created By
•	Customer Name
•	Invoice Date
•	Currency ID
Nullable columns shall be permitted only where the business process explicitly allows missing information.
________________________________________
18.5 UNIQUE Constraints
UNIQUE constraints prevent duplicate business identifiers.
Illustrative examples:
organization_id + customer_code
organization_id + supplier_code
organization_id + employee_number
The scope of uniqueness shall be defined according to business requirements.
For multi-tenant entities, uniqueness is generally enforced within a single organization rather than globally.
________________________________________
18.6 CHECK Constraints
CHECK constraints enforce simple business rules directly within the database.
Examples include:
quantity >= 0
discount_percentage BETWEEN 0 AND 100
gross_amount >= net_amount
CHECK constraints should validate rules that can be expressed without referencing other tables.
________________________________________
18.7 DEFAULT Constraints
DEFAULT values shall represent genuine business defaults.
Examples:
is_active = TRUE
created_at = CURRENT_TIMESTAMP
DEFAULT values shall never replace proper application logic where business decisions are required.
________________________________________
18.8 Foreign Key Constraints
Every relationship between business entities shall be protected by foreign key constraints as defined in Chapter 8.
Application code shall never bypass referential integrity through manual validation alone.
________________________________________
18.9 Exclusion Constraints
Where business processes involve ranges or schedules, PostgreSQL exclusion constraints may be employed.
Examples include:
•	Booking systems.
•	Reservation periods.
•	Resource scheduling.
•	Equipment allocation.
These constraints prevent overlapping allocations without requiring complex application logic.
________________________________________
18.10 Constraint Ownership
Every constraint shall have:
•	A documented business purpose.
•	A predictable naming convention (Chapter 4).
•	Associated architectural documentation.
Constraint definitions should remain synchronized with application validation rules.
________________________________________
18.11 Validation Layers
Business validation shall occur at multiple layers.
Frontend
Provides immediate feedback.
Backend
Implements business workflows.
Database
Guarantees final integrity.
Failure at any application layer shall not compromise database consistency.
________________________________________
18.12 Exception Handling
Constraint violations shall return standardized error responses.
Applications should translate database errors into meaningful business messages without exposing internal database implementation details.
________________________________________
18.13 Anti-Patterns
The following practices are prohibited:
•	Relying solely on frontend validation.
•	Removing constraints to simplify imports.
•	Ignoring constraint violations.
•	Duplicating inconsistent validation rules.
•	Disabling integrity checks in production.
________________________________________
18.14 Summary
Database constraints provide the final line of defense against inconsistent or invalid business data.
Every ERP module shall leverage database constraints to maintain long-term reliability and data quality.
________________________________________
Chapter 19
Database Normalization Strategy
________________________________________
19.1 Introduction
Database normalization is the process of organizing data to eliminate redundancy, improve consistency, and simplify maintenance.
A well-normalized database minimizes duplicate information while preserving clear relationships between business entities.
The Enterprise ERP Platform adopts normalization as the default design principle while allowing carefully documented exceptions for performance optimization.
________________________________________
19.2 Objectives
The normalization strategy aims to:
•	Eliminate redundant data.
•	Prevent update anomalies.
•	Simplify maintenance.
•	Improve consistency.
•	Reduce storage requirements.
•	Support modular development.
________________________________________
19.3 First Normal Form (1NF)
Every table shall satisfy First Normal Form.
Requirements include:
•	One value per column.
•	No repeating groups.
•	Atomic attributes.
•	Clearly defined primary keys.
Incorrect example:
phone_numbers: 9876543210, 9988776655
Correct approach:
Separate the phone numbers into individual records in a contact table.
Each phone number occupies a separate record.
________________________________________
19.4 Second Normal Form (2NF)
Every non-key attribute shall depend upon the entire primary key.
Since the ERP adopts UUID primary keys rather than composite keys, most tables naturally satisfy Second Normal Form.
Nevertheless, derived dependencies shall be avoided.
________________________________________
19.5 Third Normal Form (3NF)
No non-key attribute shall depend upon another non-key attribute.
Example:
Incorrect:
Customer → City Name → State Name → Country Name
Correct:
Customer → City → State → Country
Reference tables eliminate unnecessary duplication.
________________________________________
19.6 Boyce-Codd Normal Form (BCNF)
Where practical, database designs should satisfy Boyce-Codd Normal Form.
This further strengthens data integrity by ensuring every determinant functions as a candidate key.
________________________________________
19.7 Controlled Denormalization
Normalization remains the default strategy.
However, controlled denormalization may be introduced where measurable performance benefits justify additional redundancy.
Examples include:
•	Reporting summaries.
•	Dashboard aggregates.
•	Search optimization.
•	Materialized views.
Denormalization shall always be documented through an Architecture Decision Record (ADR).
________________________________________
19.8 Lookup Tables
Stable reference information shall be separated into lookup tables.
Examples:
•	Country
•	Currency
•	Tax Category
•	Payment Method
•	Unit of Measure
Lookup tables improve consistency while reducing duplication.
________________________________________
19.9 Derived Data
Derived values should generally not be stored unless:
•	Recalculation is expensive.
•	Historical preservation is required.
•	Performance requirements justify persistence.
Examples include:
•	Invoice Totals.
•	Inventory Balances.
•	Ledger Summaries.
Such fields must remain synchronized with their underlying business data.
________________________________________
19.10 Data Duplication
Duplicate business information should be avoided whenever possible.
Exceptions include:
•	Historical snapshots.
•	Reporting optimization.
•	Offline synchronization.
Every intentional duplication shall have documented justification.
________________________________________
19.11 Normalization vs Performance
Excessive normalization may increase query complexity.
Likewise, excessive denormalization introduces inconsistency.
The ERP seeks an appropriate balance:
•	Operational tables remain normalized.
•	Reporting structures may be selectively denormalized.
________________________________________
19.12 Examples
Well-Normalized Structure
Customer → City → State → Country
Sales Invoice → Customer → Currency → Payment Terms
Each entity maintains its own responsibilities.
________________________________________
19.13 Anti-Patterns
The following practices are prohibited:
•	Copying Master Data into transaction tables without justification.
•	Storing multiple values within a single column.
•	Using comma-separated lists.
•	Duplicating lookup information.
•	Creating excessively wide tables to avoid joins.
________________________________________
19.14 Summary
Normalization provides the structural discipline required for long-term database maintainability.
The Enterprise ERP Platform adopts Third Normal Form as the standard while permitting carefully controlled denormalization where justified by measurable business or performance requirements.
The following chapter expands upon these principles by defining the official strategy for database partitioning, archival, and long-term scalability.
End of Volume 2 — Chapters 18 & 19
Enterprise ERP Software Architecture Document
Volume 2 — Database Architecture & Standards
Version: 1.0
Part IV — Advanced Database Design
________________________________________
Chapter 20
Database Partitioning Strategy
________________________________________
20.1 Introduction
As organizations continue to use the ERP platform over many years, transactional tables will grow from thousands of records to millions or even billions of records.
Examples include:
•	Sales Invoices
•	Journal Entries
•	Stock Transactions
•	Audit Logs
•	Payment Records
•	API Logs
Without an appropriate partitioning strategy, query performance, maintenance operations, backup procedures, and index management become increasingly difficult.
The Enterprise ERP Platform therefore adopts a partitioning strategy that allows the database to scale while maintaining predictable performance.
Partitioning shall be implemented only where justified by data volume and operational requirements.
________________________________________
20.2 Objectives
The partitioning strategy aims to:
•	Improve query performance.
•	Reduce maintenance windows.
•	Simplify archival.
•	Accelerate backup and recovery.
•	Improve index efficiency.
•	Support future horizontal scalability.
________________________________________
20.3 What is Partitioning?
Partitioning divides one logical table into multiple smaller physical partitions.
Applications continue interacting with the table as though it were a single object.
Example:
sales_invoice
├── 2025 Partition
├── 2026 Partition
├── 2027 Partition
└── Future Partition
PostgreSQL automatically routes data to the appropriate partition.
________________________________________
20.4 Candidate Tables
Not every table should be partitioned.
Typical candidates include:
•	audit_log
•	activity_log
•	sales_invoice
•	purchase_invoice
•	stock_transaction
•	journal_entry
•	payment_transaction
•	notification_log
Master Data tables rarely require partitioning.
________________________________________
20.5 Partitioning Methods
PostgreSQL supports several partitioning strategies.
Range Partitioning
Suitable for:
•	Dates
•	Financial Years
•	Accounting Periods
Example:
2025, 2026, 2027
________________________________________
List Partitioning
Suitable for:
•	Organization
•	Country
•	Region
•	Business Unit
Example:
Organization A, Organization B, Organization C
________________________________________
Hash Partitioning
Suitable for:
•	Large tenant distributions.
•	High-volume insert workloads.
•	Even data distribution.
________________________________________
20.6 Recommended Strategy
The ERP adopts the following recommendations:
Table Type	Preferred Partition
Audit Logs	Range by Date
Activity Logs	Range by Date
Journal Entries	Financial Year
Sales Transactions	Financial Year
Inventory Transactions	Financial Year
API Logs	Monthly Range
Notifications	Monthly Range
Partitioning strategy shall be selected according to business access patterns rather than table size alone.
________________________________________
20.7 Partition Keys
Partition keys should satisfy the following characteristics:
•	Stable.
•	Frequently filtered.
•	Predictable.
•	Immutable.
•	Business meaningful.
Suitable examples include:
•	Transaction Date.
•	Financial Year.
•	Audit Timestamp.
Changing a partition key after insertion is strongly discouraged.
________________________________________
20.8 Automatic Partition Creation
The database administration process shall create future partitions before they are required.
Illustrative schedule:
December 2026 → Create 2027 Partitions
This avoids runtime failures caused by missing partitions.
________________________________________
20.9 Query Optimization
Partition pruning enables PostgreSQL to access only relevant partitions.
Example:
WHERE financial_year_id = 2026
Rather than scanning every partition, PostgreSQL reads only the required partition.
This significantly improves performance.
________________________________________
20.10 Maintenance Benefits
Partitioning simplifies:
•	Vacuum operations.
•	Index rebuilding.
•	Backup scheduling.
•	Data archival.
•	Storage optimization.
Individual partitions may be maintained independently without affecting the entire table.
________________________________________
20.11 Limitations
Partitioning introduces additional complexity.
Examples include:
•	More complex migrations.
•	Additional maintenance scripts.
•	Planning future partitions.
•	Monitoring partition health.
Accordingly, partitioning should be introduced only where measurable benefits exist.
________________________________________
20.12 Anti-Patterns
The following practices are prohibited:
•	Partitioning every table.
•	Choosing unstable partition keys.
•	Mixing unrelated partition strategies.
•	Creating excessive partition counts.
•	Ignoring partition maintenance.
________________________________________
20.13 Summary
Partitioning enables the ERP platform to manage very large datasets efficiently while preserving application transparency.
The architecture favors business-driven partitioning strategies that balance operational simplicity with long-term scalability.
________________________________________
Chapter 21
Data Archival & Historical Data Management
________________________________________
21.1 Introduction
Enterprise ERP systems accumulate business information over many years.
While historical records remain valuable for compliance, auditing, and reporting, they are accessed far less frequently than current operational data.
Maintaining decades of historical information within active operational tables can negatively affect performance and increase maintenance costs.
Accordingly, the ERP defines a standardized archival strategy.
________________________________________
21.2 Objectives
The archival strategy seeks to:
•	Preserve historical information.
•	Improve operational performance.
•	Reduce storage costs.
•	Simplify maintenance.
•	Support regulatory compliance.
•	Maintain reporting capability.
________________________________________
21.3 Definition
Archival refers to relocating inactive business information from active operational storage to long-term historical storage while preserving accessibility when required.
Archived information remains available but is no longer part of day-to-day business operations.
________________________________________
21.4 Candidate Data
Examples of archival candidates include:
•	Closed Financial Years.
•	Completed Payroll Runs.
•	Historical Audit Logs.
•	Old Notification Records.
•	Import History.
•	API Logs.
•	Archived Documents.
Active Master Data generally remains outside the archival process.
________________________________________
21.5 Archival Criteria
Records become eligible for archival according to business rules.
Illustrative criteria include:
•	Financial Year Closed.
•	Retention Period Expired.
•	Transaction Fully Completed.
•	No Pending Workflow.
•	Legal Hold Not Active.
Archival shall never violate regulatory obligations.
________________________________________
21.6 Archival Methods
The ERP supports multiple archival approaches.
Separate Archive Tables
Example:
sales_invoice → sales_invoice_archive
________________________________________
Separate Database
Historical information may be moved into a dedicated archival database.
________________________________________
Cold Storage
Very old documents and attachments may be transferred to low-cost storage solutions while retaining metadata within the ERP.
________________________________________
21.7 Accessibility
Archived data shall remain searchable by authorized users.
Typical capabilities include:
•	Historical reporting.
•	Audit investigations.
•	Regulatory compliance.
•	Customer service inquiries.
Applications should clearly indicate when displayed information originates from archival storage.
________________________________________
21.8 Integrity
Archival shall preserve:
•	Primary Keys.
•	Foreign Keys (where applicable).
•	Business Codes.
•	Audit Information.
•	Version History.
No historical information shall be modified during the archival process.
________________________________________
21.9 Automation
Archival operations should be automated through scheduled maintenance jobs.
Typical schedule:
•	Monthly.
•	Quarterly.
•	Annually.
Execution frequency depends upon business requirements.
________________________________________
21.10 Restoration
Where business policies permit, archived information may be restored to operational storage.
Restoration procedures shall:
•	Validate dependencies.
•	Preserve identifiers.
•	Record restoration events.
•	Maintain audit history.
________________________________________
21.11 Legal Hold
Some records may be exempt from archival or deletion due to legal or regulatory requirements.
Examples include:
•	Litigation.
•	Tax Investigations.
•	Government Audits.
•	Contractual Obligations.
Legal hold policies override standard retention schedules.
________________________________________
21.12 Performance Benefits
Proper archival provides:
•	Smaller operational tables.
•	Faster queries.
•	Improved index performance.
•	Reduced maintenance windows.
•	Lower infrastructure costs.
________________________________________
21.13 Anti-Patterns
The following practices are prohibited:
•	Deleting historical business records instead of archiving.
•	Archiving active transactions.
•	Losing audit information during archival.
•	Breaking referential integrity.
•	Archiving without documented retention policies.
________________________________________
21.14 Summary
Data archival enables the ERP platform to balance operational performance with long-term historical preservation.
By separating inactive information from active business data, the system maintains responsiveness while continuing to satisfy regulatory, operational, and analytical requirements.
The next chapter defines the enterprise backup and disaster recovery strategy, ensuring that business information remains protected against hardware failures, software defects, accidental deletion, and catastrophic events.
End of Volume 2 — Chapters 20 & 21
Enterprise ERP Software Architecture Document
Volume 2 — Database Architecture & Standards
Version: 1.0
Part IV — Advanced Database Design
________________________________________
Chapter 22
Backup, Recovery & Disaster Recovery Strategy
________________________________________
22.1 Introduction
Business information is one of the most valuable assets of an organization. Hardware failures, software defects, cyberattacks, accidental deletion, natural disasters, and human error can all result in data loss.
A reliable ERP system must therefore assume that failures will occur and provide mechanisms for rapid recovery with minimal business disruption.
The Enterprise ERP Platform adopts a comprehensive backup and disaster recovery strategy to ensure business continuity and data protection.
________________________________________
22.2 Objectives
The backup and recovery strategy aims to:
•	Protect business data.
•	Minimize downtime.
•	Reduce data loss.
•	Support regulatory compliance.
•	Enable rapid recovery.
•	Ensure business continuity.
________________________________________
22.3 Key Definitions
Backup
A backup is a secure copy of business data used to restore information after data loss or corruption.
________________________________________
Recovery
Recovery is the process of restoring data and services following an incident.
________________________________________
Disaster Recovery (DR)
Disaster Recovery refers to the complete restoration of business operations after catastrophic failure affecting infrastructure, databases, or entire data centers.
________________________________________
Recovery Point Objective (RPO)
RPO defines the maximum acceptable amount of data loss.
Example: RPO = 15 Minutes means the organization may lose at most fifteen minutes of data.
________________________________________
Recovery Time Objective (RTO)
RTO defines the maximum acceptable time required to restore service.
Example: RTO = 2 Hours means the ERP should become operational within two hours.
________________________________________
22.4 Backup Types
The ERP supports multiple backup strategies.
Full Backup
A complete copy of the database.
Typically performed:
•	Weekly
•	Monthly
________________________________________
Incremental Backup
Stores only changes since the previous backup.
Benefits:
•	Faster execution.
•	Lower storage consumption.
________________________________________
Differential Backup
Stores changes since the last full backup.
Useful when recovery speed is prioritized.
________________________________________
Continuous WAL Archiving
PostgreSQL Write-Ahead Log (WAL) archiving enables Point-in-Time Recovery (PITR).
This mechanism allows restoration to a precise moment before failure.
________________________________________
22.5 Backup Frequency
Illustrative schedule:
Backup Type	Frequency
Full Backup	Weekly
Incremental Backup	Daily
WAL Archive	Continuous
Configuration Backup	After Changes
Actual schedules shall be determined according to organizational requirements.
________________________________________
22.6 Backup Storage
Backups shall be stored securely in multiple locations.
Recommended locations include:
•	Primary Backup Server.
•	Secondary Data Center.
•	Cloud Storage.
•	Offline Storage.
No organization shall rely upon a single backup location.
________________________________________
22.7 Encryption
All backups shall be encrypted during:
•	Storage.
•	Transmission.
•	Restoration.
Encryption keys shall be managed separately from backup files.
________________________________________
22.8 Backup Verification
Creating backups is insufficient unless restoration is verified.
Regular validation shall include:
•	Backup integrity checks.
•	Test restorations.
•	Recovery timing.
•	Data consistency validation.
Backups that cannot be restored shall be considered invalid.
________________________________________
22.9 Disaster Recovery Environment
The ERP shall support a dedicated Disaster Recovery environment.
Typical components include:
•	Secondary Database Server.
•	Application Servers.
•	Object Storage.
•	Monitoring Infrastructure.
•	Network Configuration.
The Disaster Recovery environment shall remain synchronized according to defined RPO objectives.
________________________________________
22.10 Recovery Procedures
Recovery documentation shall include:
•	Recovery prerequisites.
•	Restoration sequence.
•	Validation procedures.
•	User communication.
•	Incident documentation.
Recovery procedures shall be tested regularly.
________________________________________
22.11 Security
Backup access shall be restricted to authorized personnel.
Administrative actions shall be audited.
Sensitive business information contained within backups shall remain protected according to organizational security policies.
________________________________________
22.12 Anti-Patterns
The following practices are prohibited:
•	Maintaining only one backup.
•	Storing backups on the production server alone.
•	Never testing restoration procedures.
•	Keeping encryption keys with backup files.
•	Ignoring failed backup notifications.
________________________________________
22.13 Summary
Reliable backup and disaster recovery procedures are essential for protecting business continuity.
The Enterprise ERP Platform shall maintain secure, verified, and regularly tested backup mechanisms capable of restoring business operations within defined recovery objectives.
________________________________________
Chapter 23
Database Security Architecture
________________________________________
23.1 Introduction
The database is the authoritative source of all business information managed by the ERP platform (as defined in Chapter 1.3).
Protecting this information requires multiple layers of security extending beyond application authentication.
Database security encompasses:
•	Authentication.
•	Authorization.
•	Encryption.
•	Auditing.
•	Monitoring.
•	Data isolation.
•	Administrative controls.
Security shall be considered a core architectural principle rather than an optional enhancement.
________________________________________
23.2 Objectives
The database security architecture aims to:
•	Protect confidential information.
•	Prevent unauthorized access.
•	Preserve data integrity.
•	Support compliance.
•	Enable auditing.
•	Reduce attack surface.
________________________________________
23.3 Defense in Depth
Security shall be implemented using multiple independent layers.
Typical layers include:
Network → Firewall → Application → Authentication → Authorization → Database → Storage Encryption
Failure of one layer shall not compromise the entire system.
________________________________________
23.4 Authentication
Applications shall authenticate users before any database operation.
The database itself shall not be directly accessible by end users.
Only trusted backend services shall communicate with PostgreSQL.
________________________________________
23.5 Authorization
Every database operation shall execute according to the authenticated user's permissions.
Authorization decisions shall be enforced by backend services using Role-Based Access Control (RBAC).
Database users shall possess only the minimum privileges required.
________________________________________
23.6 Principle of Least Privilege
Every account shall receive the smallest set of permissions necessary.
Examples:
Application Account
•	Read
•	Insert
•	Update
•	Limited Delete (Soft Delete)
Reporting Account
•	Read Only
Migration Account
•	Schema Changes
•	Administrative Operations
Administrator Account
•	Restricted Operational Use
________________________________________
23.7 Connection Security
All database connections shall use encrypted communication.
Recommended technologies include:
•	TLS
•	Secure Certificates
•	Mutual Authentication where applicable
Unencrypted production database connections are prohibited.
________________________________________
23.8 Sensitive Data
Sensitive business information shall receive additional protection.
Examples include:
•	Password Hashes.
•	API Keys.
•	Personal Information.
•	Financial Information.
•	Authentication Tokens.
Sensitive information shall never be stored in plain text unless technically unavoidable and explicitly approved.
________________________________________
23.9 Password Storage
Passwords shall never be stored directly.
Only secure password hashes generated using modern password hashing algorithms shall be stored.
Plain-text passwords are strictly prohibited.
________________________________________
23.10 SQL Injection Protection
All database operations shall use parameterized queries or prepared statements.
Dynamic SQL constructed through string concatenation is prohibited.
Backend frameworks shall enforce safe query generation.
________________________________________
23.11 Audit Logging
Security-related activities shall be logged.
Examples include:
•	Login Attempts.
•	Permission Changes.
•	Failed Authentication.
•	Administrative Actions.
•	Configuration Changes.
•	Data Export Operations.
Audit logs shall be protected against unauthorized modification.
________________________________________
23.12 Monitoring
Continuous monitoring shall include:
•	Failed Login Attempts.
•	Suspicious Query Activity.
•	Privilege Escalation.
•	Excessive Data Access.
•	Database Errors.
Automated alerts should notify administrators of potential security incidents.
________________________________________
23.13 Administrative Access
Administrative database access shall be tightly controlled.
Recommended practices include:
•	Multi-factor Authentication.
•	Named Administrative Accounts.
•	Session Logging.
•	Time-Limited Privileges.
•	Change Approval Procedures.
Shared administrator credentials are prohibited.
________________________________________
23.14 Compliance
The security architecture should support compliance with applicable standards and regulations, including organizational policies and relevant legal requirements.
Compliance requirements shall influence:
•	Logging.
•	Retention.
•	Encryption.
•	Access Control.
•	Incident Response.
________________________________________
23.15 Anti-Patterns
The following practices are prohibited:
•	Shared database administrator accounts.
•	Hardcoded credentials.
•	Plain-text passwords.
•	Unencrypted production connections.
•	Excessive database privileges.
•	Direct end-user database access.
________________________________________
23.16 Summary
Database security is fundamental to the reliability and trustworthiness of the ERP platform.
By implementing layered security controls, enforcing least privilege, protecting sensitive information, and maintaining comprehensive audit trails, the Enterprise ERP Platform establishes a robust foundation for secure business operations.
The next chapter introduces the Database Migration Strategy, defining how schema changes are planned, versioned, reviewed, tested, and deployed throughout the lifecycle of the ERP.
End of Volume 2 — Chapters 22 & 23
Enterprise ERP Software Architecture Document
Volume 2 — Database Architecture & Standards
Version: 1.0
Part V — Database Lifecycle & Governance
________________________________________
Chapter 24
Database Migration Strategy
________________________________________
24.1 Introduction
A database schema is not static. As business requirements evolve, new modules are introduced, regulations change, and performance optimizations become necessary, the database must evolve in a controlled and predictable manner.
Uncontrolled schema modifications can result in application failures, data corruption, downtime, and inconsistent environments.
The Enterprise ERP Platform adopts a migration-based database lifecycle in which every schema modification is version-controlled, reviewed, tested, and deployed through standardized procedures.
Database migrations form an integral part of the ERP source code and are treated with the same discipline as application development.
________________________________________
24.2 Objectives
The migration strategy aims to:
•	Maintain schema consistency across environments.
•	Enable controlled database evolution.
•	Support automated deployments.
•	Preserve existing business data.
•	Minimize deployment risks.
•	Maintain complete change history.
________________________________________
24.3 Definition
A Database Migration is a version-controlled script that modifies the database structure or data in a predictable and repeatable manner.
Typical migration activities include:
•	Creating new tables.
•	Adding columns.
•	Modifying constraints.
•	Creating indexes.
•	Introducing new modules.
•	Updating reference data.
Every migration shall have a unique identifier and execution order.
________________________________________
24.4 Migration Principles
Every migration shall satisfy the following principles:
•	Repeatable.
•	Version-controlled.
•	Atomic.
•	Idempotent where practical.
•	Auditable.
•	Fully documented.
Manual production schema changes are prohibited except during approved emergency procedures.
________________________________________
24.5 Version Control
All migration files shall be stored within the project's source code repository.
Each migration shall include:
•	Migration Identifier.
•	Version Number.
•	Creation Date.
•	Author.
•	Description.
Illustrative naming convention:
20260805_001_create_customer_table.sql
Migration naming standards shall remain consistent throughout the project.
________________________________________
24.6 Execution Order
Migrations shall execute sequentially.
Example:
001 → 002 → 003 → 004
Skipping migration versions is prohibited.
The database shall always maintain a record of executed migrations.
________________________________________
24.7 Forward-Only Strategy
The ERP adopts a forward-only migration philosophy.
Rather than editing previously executed migrations:
•	New migrations introduce new changes.
•	Historical migrations remain immutable.
This preserves deployment consistency across all environments.
________________________________________
24.8 Rollback Strategy
Although forward migrations are preferred, rollback procedures shall be documented for critical releases.
Rollback may involve:
•	Reverse migration scripts.
•	Database restoration.
•	Feature deactivation.
•	Controlled emergency procedures.
Rollback planning shall be completed before production deployment.
________________________________________
24.9 Data Migrations
Some releases require transformation of existing business data.
Examples include:
•	Splitting columns.
•	Populating new reference tables.
•	Updating business codes.
•	Recalculating derived values.
Data migrations shall preserve business integrity and auditability.
________________________________________
24.10 Module-Based Migrations
Because the ERP is modular, each module may contribute its own migration set.
Illustrative structure:
Core → Finance → Inventory → Sales → Human Resources → Manufacturing
The migration framework shall ensure that module dependencies are respected during execution.
________________________________________
24.11 Environment Consistency
Development, Testing, Staging, and Production environments shall always execute identical migration sequences.
No environment-specific schema modifications shall be permitted.
Configuration differences shall be managed separately from schema definitions.
________________________________________
24.12 Validation
Every migration shall undergo:
•	Code Review.
•	Automated Testing.
•	Performance Validation.
•	Schema Verification.
•	Dependency Analysis.
Production deployment shall occur only after successful validation.
________________________________________
24.13 Emergency Fixes
Emergency production changes shall be minimized.
Where emergency modifications become necessary:
•	Changes shall be documented.
•	Equivalent migration files shall be committed immediately afterward.
•	Schema consistency shall be restored across all environments.
________________________________________
24.14 Anti-Patterns
The following practices are prohibited:
•	Editing historical migrations after deployment.
•	Executing undocumented production SQL.
•	Skipping migration versions.
•	Combining unrelated changes within one migration.
•	Deploying untested migrations.
________________________________________
24.15 Summary
Database migrations provide a disciplined framework for managing schema evolution.
By treating schema changes as version-controlled software artifacts, the ERP ensures predictable deployments, consistent environments, and reliable long-term maintenance.
Refer to Chapter 4 for comprehensive naming standards and conventions.

---
________________________________________
Chapter 26
Enterprise Database Governance Model
________________________________________
26.1 Introduction
An Enterprise Resource Planning (ERP) database is one of the organization's most valuable assets. As the system grows over many years, multiple development teams, database administrators, architects, quality assurance engineers, DevOps personnel, and business analysts will contribute to its evolution.
Without proper governance, the database can quickly become inconsistent, difficult to maintain, and vulnerable to performance and security issues.
The Enterprise ERP Platform therefore establishes a formal Database Governance Model that defines ownership, responsibilities, review processes, and decision-making authority for all database-related activities.
Database governance ensures that every structural change aligns with the long-term vision of the platform.
________________________________________
26.2 Objectives
The governance framework aims to:
•	Maintain architectural consistency.
•	Protect business data.
•	Standardize development practices.
•	Improve long-term maintainability.
•	Reduce technical debt.
•	Support regulatory compliance.
•	Ensure high-quality database design.
________________________________________
26.3 Governance Principles
The following principles govern all database activities:
•	Architecture First.
•	Security by Design.
•	Performance by Design.
•	Documentation Before Implementation.
•	Review Before Deployment.
•	Automation Wherever Possible.
•	Continuous Improvement.
Every database decision shall be evaluated against these principles.
________________________________________
26.4 Roles and Responsibilities
The governance model defines clear ownership for database-related activities.
Enterprise Architect
Responsible for:
•	Overall database architecture.
•	Technology decisions.
•	Architectural standards.
•	Long-term roadmap.
________________________________________
Database Architect
Responsible for:
•	Schema design.
•	Relationships.
•	Constraints.
•	Performance optimization.
•	Data modeling.
________________________________________
Backend Development Team
Responsible for:
•	Implementing business logic.
•	Writing migrations.
•	Maintaining ORM models.
•	API integration.
________________________________________
Database Administrator (DBA)
Responsible for:
•	Database availability.
•	Performance monitoring.
•	Backup.
•	Disaster recovery.
•	Security.
•	Maintenance.
________________________________________
Quality Assurance Team
Responsible for:
•	Database testing.
•	Migration validation.
•	Performance verification.
•	Data integrity testing.
________________________________________
DevOps Team
Responsible for:
•	Deployment automation.
•	Infrastructure provisioning.
•	Monitoring.
•	CI/CD integration.
________________________________________
26.5 Change Approval Process
All structural database changes shall follow a formal approval workflow.
Illustrative process:
Requirement → Architecture Review → Design Approval → Development → Testing → Migration Review → Deployment → Monitoring
Unauthorized schema modifications are prohibited.
________________________________________
26.6 Documentation Requirements
Every significant database change shall include:
•	Business justification.
•	Technical design.
•	Migration script.
•	Testing evidence.
•	Rollback procedure.
•	Updated documentation.
Documentation is considered part of the deliverable.
________________________________________
26.7 Architecture Decision Records (ADR)
Major database decisions shall be documented using Architecture Decision Records (ADR).
Typical ADR topics include:
•	UUID primary keys.
•	Multi-tenant architecture.
•	Soft delete implementation.
•	Partitioning strategy.
•	Archival approach.
•	Indexing standards.
ADRs provide historical context for future development teams.
________________________________________
26.8 Performance Governance
Database performance shall be reviewed regularly.
Performance reviews should include:
•	Slow query analysis.
•	Index utilization.
•	Resource consumption.
•	Execution plans.
•	Storage growth.
•	Partition health.
Performance improvements shall be based on measurable evidence.
________________________________________
26.9 Security Governance
Database security reviews shall evaluate:
•	User privileges.
•	Encryption.
•	Audit logs.
•	Authentication.
•	Access control.
•	Compliance requirements.
Security reviews shall occur periodically and after significant architectural changes.
________________________________________
26.10 Data Quality Governance
Business data quality shall be monitored continuously.
Examples include:
•	Duplicate detection.
•	Missing mandatory data.
•	Invalid references.
•	Inconsistent codes.
•	Orphaned records.
Corrective actions shall be documented and tracked.
________________________________________
26.11 Compliance Governance
Database governance shall support applicable legal, contractual, and organizational requirements.
Governance activities may include:
•	Retention policy reviews.
•	Audit readiness.
•	Privacy controls.
•	Access reviews.
•	Regulatory reporting.
Compliance shall be integrated into routine governance rather than treated as a separate activity.
________________________________________
26.12 Continuous Improvement
The governance model shall evolve over time.
Periodic reviews should evaluate:
•	Emerging PostgreSQL features.
•	New security recommendations.
•	Performance enhancements.
•	Development practices.
•	Lessons learned from production.
Continuous improvement ensures that the ERP remains modern and maintainable.
________________________________________
26.13 Anti-Patterns
The following practices are prohibited:
•	Undocumented schema changes.
•	Direct production database modifications.
•	Ignoring architectural reviews.
•	Unapproved performance optimizations.
•	Bypassing migration procedures.
________________________________________
26.14 Summary
Database governance establishes the organizational processes required to maintain a high-quality ERP database throughout its lifecycle.
By combining technical standards with disciplined review procedures, the Enterprise ERP Platform ensures long-term stability, scalability, and maintainability.
________________________________________
Chapter 27
Volume 2 Summary & Architectural Conclusions
________________________________________
27.1 Introduction
Volume 2 has defined the complete database architecture and governance framework for the Enterprise ERP Platform.
The principles established throughout this volume provide the foundation for every database object, migration, business module, and integration that will be developed in future volumes.
These standards ensure that the ERP remains scalable, secure, modular, and maintainable throughout its operational life.
________________________________________
27.2 Architectural Decisions Established
The following key architectural decisions have been formally adopted:
•	PostgreSQL as the relational database.
•	UUID-based primary keys.
•	Shared Database, Shared Schema Multi-Tenant Architecture.
•	Soft Delete as the default deletion strategy.
•	Optimistic Concurrency Control.
•	Comprehensive Audit Framework.
•	Modular Database Design.
•	Forward-only Database Migrations.
•	Standardized Naming Conventions.
•	Enterprise Database Governance.
These decisions form the architectural baseline for the entire platform.
________________________________________
27.3 Core Design Principles
The database architecture is based on the following principles:
•	Scalability.
•	Security.
•	Maintainability.
•	Modularity.
•	Consistency.
•	Reliability.
•	Performance.
•	Extensibility.
Every future database enhancement shall align with these principles.
________________________________________
27.4 Relationship to Other Volumes
The database architecture defined in this volume directly supports:
Volume 1 — Enterprise Vision and Software Architecture.
Volume 3 — Backend Architecture, APIs, Business Services, and Domain Logic.
Volume 4 — Authentication, Authorization, Identity, and Security.
Volume 5 — Module Architecture and Business Domains.
Volume 6 — Frontend Architecture (Flutter).
Volume 7 — Deployment, DevOps, Monitoring, and Operations.
________________________________________
27.5 Implementation Roadmap
The recommended implementation sequence is:
1.	Core Platform Schema.
2.	Identity and Authentication.
3.	Organization and Tenant Management.
4.	Module Framework.
5.	Finance Module.
6.	Inventory Module.
7.	Sales and CRM.
8.	Purchasing.
9.	Human Resources.
10.	Manufacturing.
11.	Reporting and Analytics.
12.	AI and Automation Services.
This sequence minimizes dependencies and enables incremental delivery.
________________________________________
27.6 Long-Term Vision
The database architecture is designed to support:
•	Millions of business transactions.
•	Thousands of organizations.
•	Hundreds of ERP modules.
•	Cloud-native deployment.
•	Mobile applications.
•	AI-assisted workflows.
•	Third-party integrations.
•	Future architectural evolution.
The platform is intended to remain relevant and maintainable for many years without requiring fundamental redesign.
________________________________________
27.7 Final Statement
A successful ERP system is built upon a reliable database architecture.
By adopting disciplined design principles, standardized governance, modular structures, and modern PostgreSQL capabilities, the Enterprise ERP Platform establishes a strong technical foundation capable of supporting organizations of varying sizes and industries.
The database is not merely a storage layer—it is the central source of truth that enables every business process, report, workflow, and decision within the ERP ecosystem.
________________________________________
27.8 Conclusion
This concludes Volume 2 – Database Architecture & Standards.
The next volume will focus on the Backend Architecture, where these database principles will be transformed into domain services, business logic, APIs, validation layers, workflows, event processing, and module communication.
From this point onward, the ERP evolves from a database design into a complete enterprise application platform.
---

## APPENDICES

### Appendix A
Refer to Chapter 4 for complete naming standards and conventions.

________________________________________
Appendix B
Standard Table Templates
B.1 Purpose
Every business table should follow a standardized structure to maintain consistency throughout the ERP.
All templates include standard audit columns from Chapter 9 (created_at, created_by, updated_at, updated_by, is_deleted, deleted_at, deleted_by) and soft delete support from Chapter 10 unless explicitly noted otherwise.
________________________________________
B.2 Master Table Template
Used for: Customer, Supplier, Employee, Product, Warehouse, Department
Core Columns:
•	id (UUID)
•	organization_id (Chapter 12)
•	code
•	name
•	description
•	status
•	is_active
•	version_number (Chapter 11)
Plus standard audit columns from Chapter 9.
________________________________________
B.3 Transaction Header Template
Used for: Sales Invoice, Purchase Invoice, Journal Entry, Payment Voucher
Core Columns:
•	id (UUID)
•	organization_id (Chapter 12)
•	branch_id (Chapter 13)
•	financial_year_id (Chapter 13)
•	document_number
•	document_date
•	status
•	approval_status
•	remarks
•	version_number (Chapter 11)
Plus standard audit columns from Chapter 9.
________________________________________
B.4 Transaction Detail Template
•	id
•	header_id
•	line_number
•	product_id
•	description
•	quantity
•	unit_price
•	discount_amount
•	tax_amount
•	net_amount
________________________________________
B.5 Lookup Table Template
Used for: Currency, Language, Country, State
Core Columns:
•	id (UUID)
•	code
•	name
•	display_order
•	is_active
________________________________________
B.6 Audit Table Template
•	id
•	organization_id
•	table_name
•	record_id
•	action
•	old_value
•	new_value
•	performed_by
•	performed_at
•	ip_address
•	device_information
________________________________________
B.7 Integration Queue Template
•	id
•	organization_id
•	event_type
•	payload
•	status
•	retry_count
•	last_attempt_at
•	created_at
________________________________________
B.8 Notification Table Template
•	id
•	organization_id
•	recipient_id
•	title
•	message
•	notification_type
•	status
•	read_at
•	created_at
________________________________________
B.9 Attachment Table Template
•	id
•	organization_id
•	module_name
•	record_id
•	file_name
•	mime_type
•	storage_path
•	file_size
•	uploaded_by
•	uploaded_at
________________________________________
B.10 Required Columns Matrix
Table Type	Audit (Ch. 9)	Version	Soft Delete
Master	Yes	Yes	Yes
Transaction	Yes	Yes	Yes
Lookup	Limited	No	Optional
Audit	No	No	No
Integration	Yes	Optional	Optional
________________________________________
Appendix C
PostgreSQL Best Practices & Quick Reference

This appendix highlights key best practices covered throughout Volume 2.

**Refer to specific chapters for detailed guidance:**
- Chapter 4 — Naming Consistency
- Chapter 7 — UUID Version 7 strategy
- Chapter 6 — JSONB and data types
- Chapter 8 — Foreign Key constraints
- Chapter 18 — CHECK Constraints and validations
- Chapter 22 — Transactions
- Chapter 17 — Indexing strategy
- Chapter 10 — Soft delete policy
- Chapter 13 — ENUM usage

**Key Reminders:**
- Never concatenate SQL strings; always use parameterized queries through the ORM.
- Materialized views are recommended for dashboards, KPIs, and financial reports.
- Generated columns should be used only for deterministic calculations.
- Continuously monitor slow queries, index usage, deadlocks, and cache hit ratios.

**Final Commitment:**
The database should remain clean, predictable, highly normalized, secure, modular, extensible, well documented, and performance optimized.
Every module developed for the Enterprise ERP Platform shall comply with these standards unless an approved Architecture Decision Record (ADR) explicitly documents an exception.

________________________________________
End of Volume 2
