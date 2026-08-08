# System Architecture

**Document Purpose**: Define the layered system architecture, describe each layer's responsibility, and explain how layers interact.

**Audience**: Architects, backend developers, system designers

---

## Introduction

The ERP platform adopts a layered architecture to achieve separation of concerns, maintainability, scalability, and independent evolution of system components.

Each architectural layer performs a distinct responsibility and communicates only through clearly defined interfaces.

---

## High-Level Architecture Overview

The system consists of four primary layers:

```
┌─────────────────────────────────────┐
│    CLIENT LAYER                     │
│ (Flutter Desktop, Web, Mobile)      │
└──────────────┬──────────────────────┘
               │ REST API
┌──────────────▼──────────────────────┐
│    API LAYER                        │
│ (Routing, Validation, Auth, Error) │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│    BUSINESS LAYER                   │
│ (Services, Rules, Workflows)        │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│    DATA LAYER                       │
│ (ORM, Queries, Constraints)         │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│    PERSISTENCE LAYER                │
│ (PostgreSQL Database)               │
└─────────────────────────────────────┘
```

Each layer is independently replaceable provided its public contract remains unchanged.

---

## Layer 1: Client Layer

### Purpose

The Client Layer represents the user-facing applications through which users interact with the ERP.

### Responsibilities

The Client Layer is responsible for:
- **User Interface**: Rendering screens, forms, dialogs
- **User Interaction**: Handling clicks, navigation, gestures
- **Data Presentation**: Formatting and displaying data
- **API Communication**: Calling backend APIs
- **Local State Management**: Managing UI state (not business state)
- **User Experience Validation**: Validating input for UX feedback

### Not Responsible For

The Client Layer is NOT responsible for:
- **Database Access**: No direct database queries
- **Business Logic**: No financial calculations, inventory rules, approval logic
- **Authoritative Validation**: No enforcement of business policies
- **Security Decisions**: No permission decisions
- **Persistent Data**: Business data is on server

### Supported Platforms

| Platform | Technology | Use Case |
|----------|-----------|----------|
| Windows Desktop | Flutter Desktop | Office workers, data entry |
| Web Browser | Flutter Web | Remote access, any browser |
| Android Mobile | Flutter Mobile | Field staff, warehouse |
| iOS | (Future) | Mobile users |
| macOS | (Future) | Developer community, executives |
| Linux | (Future) | Advanced users |

### Characteristics

- **Stateless** (regarding business state): Business state is on server
- **Presentational**: Focuses on UI, not business rules
- **Distributed**: Runs on user's device
- **Autonomous**: Can function with limited connectivity (offline, TBD)
- **API Consumer**: Calls backend APIs exclusively

### Example

A sales order entry screen:

```
User fills in:
  - Customer (selected from dropdown via API)
  - Item (selected from dropdown via API)
  - Quantity (text input)

Client validates:
  - "Quantity is required" (UX validation)
  - "Quantity must be numeric" (UX validation)
  - Shows message if invalid

Client sends to backend:
  - POST /api/sales/orders
  - Body: { customerId, itemId, quantity }

Backend validates:
  - Customer exists and is not blocked
  - Item exists and is available
  - Quantity doesn't exceed stock
  - Customer credit limit not exceeded
  - All approvals configured

Client shows response:
  - Success: Order created, show confirmation
  - Error: Show error message to user
```

---

## Layer 2: API Layer

### Purpose

The API Layer provides the external interface to the ERP platform, handling all communication between clients and backend services.

### Responsibilities

The API Layer is responsible for:
- **Request Routing**: Direct HTTP requests to appropriate handlers
- **Request Validation**: Schema validation, data format validation
- **Authentication**: Validate JWT tokens, session management
- **Authorization**: Check user permissions for requested resource
- **Response Formatting**: Format business layer responses for clients
- **Error Handling**: Convert business errors to HTTP responses
- **Rate Limiting**: Protect against abuse
- **Request/Response Logging**: Create audit trail of API calls

### Not Responsible For

The API Layer is NOT responsible for:
- **Business Logic**: Approval workflows, calculations happen elsewhere
- **Data Persistence**: Writing to database happens in data layer
- **Complex Validation**: Business rule validation happens in business layer

### Architecture

```
HTTP Request
    ↓
┌───────────────────────────┐
│ Request Logging           │
└──────────┬────────────────┘
           ↓
┌───────────────────────────┐
│ Schema Validation         │
└──────────┬────────────────┘
           ↓
┌───────────────────────────┐
│ Authentication (JWT)      │
└──────────┬────────────────┘
           ↓
┌───────────────────────────┐
│ Authorization (Roles)     │
└──────────┬────────────────┘
           ↓
┌───────────────────────────┐
│ Rate Limiting             │
└──────────┬────────────────┘
           ↓
┌───────────────────────────┐
│ Route to Service Handler  │
└──────────┬────────────────┘
           ↓
Business Layer Service
```

### REST API Standards

All APIs follow REST principles:

| Operation | Method | Endpoint | Body | Response |
|-----------|--------|----------|------|----------|
| List | GET | /api/{resource} | None | Array of resources |
| Get | GET | /api/{resource}/{id} | None | Single resource |
| Create | POST | /api/{resource} | Resource data | Created resource + ID |
| Update | PUT | /api/{resource}/{id} | Changed fields | Updated resource |
| Delete | DELETE | /api/{resource}/{id} | None | Empty or confirmation |

### Error Responses

All errors follow a consistent format:

```json
{
  "error": {
    "code": "INVALID_CREDIT_LIMIT",
    "message": "Customer has exceeded credit limit",
    "details": {
      "creditLimit": 10000,
      "currentUsage": 12500,
      "available": -2500
    },
    "timestamp": "2024-01-15T10:30:00Z",
    "traceId": "abc-123-def"
  }
}
```

### Characteristics

- **Stateless**: No session state stored on server
- **Validated**: All requests validated before reaching business logic
- **Authorized**: All requests checked for user permission
- **Logged**: All requests/responses logged for audit
- **Secure**: HTTPS only, no sensitive data in logs
- **Documented**: OpenAPI schema available

---

## Layer 3: Business Layer

### Purpose

The Business Layer represents the core of the ERP platform, implementing all business rules, workflows, and calculations.

### Responsibilities

The Business Layer is responsible for:
- **Business Rules**: Enforcing policies (credit limits, stock checks, approvals)
- **Calculations**: Computing financial amounts, taxes, costs, discounts
- **Workflows**: Executing approval chains, business processes
- **Validation**: Validating business constraints
- **Permission Checking**: Enforcing fine-grained permissions (can user approve this order?)
- **Audit Events**: Creating audit records of business actions
- **Transactions**: Coordinating multi-step processes atomically

### Not Responsible For

The Business Layer is NOT responsible for:
- **User Interface**: No UI rendering
- **HTTP Handling**: API layer handles HTTP
- **Database Queries**: Data layer handles queries
- **Web Server Management**: API framework handles this

### Services

The Business Layer is organized into service modules:

| Module | Services |
|--------|----------|
| **Sales** | SalesOrderService, InvoiceService, CustomerService |
| **Purchase** | PurchaseOrderService, ReceiptService, VendorService |
| **Inventory** | StockService, WarehouseService, MovementService |
| **Manufacturing** | WorkOrderService, RoutingService, ProductionService |
| **Accounting** | LedgerService, APService, ARService, FinancialService |
| **HR** | EmployeeService, OrgStructureService, RecruitmentService |
| **Payroll** | SalaryService, TaxService, BenefitsService |
| **Assets** | AssetService, DepreciationService |
| **CRM** | CustomerService, OpportunityService, InteractionService |

### Example: Stock Check

```typescript
// Business Layer Service
async createSalesOrder(customerId, items) {
  // Validate customer
  const customer = await customerRepo.get(customerId);
  if (!customer) throw new CustomerNotFound();
  if (customer.blocked) throw new CustomerBlocked();
  
  // Check credit limit
  const usage = await arService.getTotalOutstanding(customerId);
  if (usage > customer.creditLimit) {
    throw new CreditLimitExceeded();
  }
  
  // Check stock for each item
  for (const item of items) {
    const stock = await stockService.getAvailable(item.id);
    if (stock < item.quantity) {
      throw new InsufficientStock(item.id, stock, item.quantity);
    }
  }
  
  // Reserve stock
  await stockService.reserve(items);
  
  // Create order
  const order = await orderRepo.create({...});
  
  // Post financial entries
  await ledgerService.postSalesOrder(order);
  
  // Trigger audit event
  await auditService.log('SalesOrder.Created', order.id, {...});
  
  return order;
}
```

The API layer calls this service and returns the result to the client.

### Characteristics

- **Reusable**: Called by API layer, scheduled jobs, workflows
- **Testable**: Can be tested without API or database
- **Stateless**: No session state
- **Transactional**: Changes committed atomically
- **Auditable**: All actions logged
- **Isolated**: Doesn't depend on UI or HTTP

---

## Layer 4: Data Layer

### Purpose

The Data Layer provides persistent storage, handling all interactions with the database.

### Responsibilities

The Data Layer is responsible for:
- **Data Retrieval**: Query execution, filtering, sorting, pagination
- **Data Persistence**: Inserting, updating, deleting records
- **Transactions**: ACID transaction management
- **Constraint Enforcement**: Referential integrity, uniqueness, domain constraints
- **Query Optimization**: Index utilization, query plans
- **Migration**: Schema changes, version management

### Not Responsible For

The Data Layer is NOT responsible for:
- **Business Decisions**: Whether an order can be created (business layer)
- **Calculations**: Computing totals, taxes (business layer)
- **Validation Logic**: Checking business rules (business layer)

### Repository Pattern

The Data Layer is accessed through Repository interfaces:

```typescript
interface SalesOrderRepository {
  create(order: SalesOrder): Promise<SalesOrder>;
  get(id: string): Promise<SalesOrder>;
  update(id: string, changes: Partial<SalesOrder>): Promise<SalesOrder>;
  delete(id: string): Promise<void>;
  list(filters: SalesOrderFilter): Promise<SalesOrder[]>;
  findByCustomer(customerId: string): Promise<SalesOrder[]>;
}
```

Business Layer depends on Repository interfaces, not database implementation.

### Transactions

Data Layer manages ACID transactions:

```typescript
async function createSalesOrderWithLines(order, lines) {
  const transaction = await db.beginTransaction();
  try {
    const createdOrder = await transaction.create('sales_orders', order);
    
    for (const line of lines) {
      await transaction.create('sales_order_lines', {
        ...line,
        orderId: createdOrder.id
      });
      
      await transaction.update('stock', 
        { quantity: decrement(line.quantity) },
        { itemId: line.itemId }
      );
    }
    
    await transaction.commit();
    return createdOrder;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
```

All-or-nothing guarantees ensure data consistency.

### Database Constraints

The database enforces critical constraints:

```sql
-- Referential Integrity
ALTER TABLE sales_orders
ADD CONSTRAINT fk_customer_id
FOREIGN KEY (customer_id) REFERENCES customers(id);

-- NOT NULL Constraints
ALTER TABLE sales_orders
MODIFY COLUMN customer_id NOT NULL;

-- Uniqueness
ALTER TABLE invoice_numbers
ADD CONSTRAINT uk_invoice_number UNIQUE (invoice_number);

-- Check Constraints
ALTER TABLE sales_orders
ADD CONSTRAINT check_quantity_positive
CHECK (quantity > 0);
```

---

## Platform Services

In addition to business modules, the ERP provides platform-wide services:

| Service | Purpose | Owner |
|---------|---------|-------|
| **Authentication Service** | User login, JWT token generation | Platform Team |
| **Authorization Service** | Permission checking, role management | Platform Team |
| **Audit Service** | Audit event logging, retrieval | Platform Team |
| **Notification Service** | User notifications, alerts, escalations | Platform Team |
| **File Storage Service** | Document management, file storage | Platform Team |
| **Configuration Service** | Organization settings, system config | Platform Team |
| **Scheduler Service** | Background jobs, scheduled tasks | Platform Team |
| **Reporting Service** | Report execution, report management | Platform Team |

All modules use these shared services rather than implementing duplicate functionality.

---

## Communication Between Layers

Communication flows vertically through the layers:

```
Client (Flutter) 
    ↓ (REST API)
API Layer
    ↓ (Service Method Call)
Business Layer
    ↓ (Repository Interface)
Data Layer
    ↓ (SQL Query)
PostgreSQL Database
```

**No shortcuts**: Direct communication between layers is prohibited. Client cannot call Business Layer directly; must go through API.

---

## Data Flow Example: Create Sales Order

1. **Client Layer**
   - User enters customer ID, item ID, quantity
   - Client validates fields (UX validation)
   - Client calls POST /api/sales/orders

2. **API Layer**
   - Receives request, validates schema
   - Validates JWT token (authentication)
   - Checks user permission for sales:orders:create (authorization)
   - Calls SalesOrderService.create()

3. **Business Layer**
   - SalesOrderService receives request
   - Loads Customer (via CustomerRepository)
   - Validates credit limit
   - Loads Stock (via StockRepository)
   - Validates sufficient stock
   - Reserves stock
   - Creates SalesOrder (via SalesOrderRepository)
   - Posts ledger entries (via LedgerService)
   - Creates audit event (via AuditService)
   - Returns created order

4. **Data Layer**
   - Updates sales_orders table (INSERT)
   - Updates sales_order_lines table (INSERT)
   - Updates stock table (UPDATE)
   - Updates general_ledger table (INSERT)
   - Updates audit_log table (INSERT)
   - Commits all changes atomically

5. **API Layer**
   - Receives created order from business layer
   - Formats response as JSON
   - Returns 201 Created with order data

6. **Client Layer**
   - Receives response
   - Shows confirmation message
   - Updates local UI

---

## Scalability Considerations

The architecture supports these deployment models:

| Model | Description |
|-------|-------------|
| **Single Server** | All layers on one server; suitable for small deployments |
| **Multi-Server** | API/Business layers on multiple servers; database on separate server |
| **Load Balanced** | Multiple API servers behind load balancer |
| **Containerized** | Layers deployed as Docker containers; orchestrated by Kubernetes |
| **Cloud** | Hosted on AWS, Azure, GCP with managed database |

The architecture remains identical regardless of deployment topology.

---

## Summary

The layered architecture provides clear separation of concerns:

- **Clients** focus on user experience
- **API** handles HTTP and validation
- **Business Layer** implements business rules
- **Data Layer** manages persistence
- **Database** enforces integrity

Each layer can be tested, modified, and scaled independently while maintaining architectural consistency.

---

## Related Documents

- **[Design Philosophy](./01-design-philosophy.md)** — Why we layer the architecture
- **[Architectural Boundaries](./03-boundaries.md)** — Module boundaries within layers
- **[Technology Stack](../05-frontend/README.md)** — Technology for each layer
- **[Module Architecture](../08-business-modules/README.md)** — How modules are organized
