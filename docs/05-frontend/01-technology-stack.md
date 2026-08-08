# Technology Stack

**Document Purpose**: Define the official technology stack for the ERP platform, justify selections, and establish technology governance.

**Audience**: All technical staff, procurement, operations

---

## Introduction

Technology selection is one of the most significant architectural decisions in the lifecycle of an enterprise software platform. The chosen technologies directly influence maintainability, performance, developer productivity, deployment flexibility, scalability, and long-term sustainability.

The technology stack has been evaluated based on:
- Long-term industry support
- Stability and maturity
- Community adoption
- Performance
- Cross-platform capabilities
- Development productivity
- Ease of maintenance
- Open-source licensing
- Enterprise suitability

The technologies described in this section constitute the official technology stack for Version 1.x of the ERP platform.

---

## Technology Overview

| Layer | Technology | Version | Justification |
|-------|-----------|---------|---|
| **Frontend Framework** | Flutter | Latest stable | Single codebase, multiple platforms |
| **Frontend Language** | Dart | Latest stable | Strong typing, modern syntax, hot reload |
| **Backend Runtime** | Node.js | Latest LTS | Performance, ecosystem, async architecture |
| **Backend Language** | TypeScript | Latest stable | Type safety, maintainability, IDE support |
| **Web Framework** | Fastify | Latest stable | High performance, validation, schema support |
| **Database** | PostgreSQL | Latest stable | ACID, JSON, partitioning, reliability |
| **ORM** | Drizzle ORM | Latest stable | Type-safe SQL, migrations, performance |
| **Validation** | Zod | Latest stable | Schema validation, runtime checks |
| **Authentication** | JWT | N/A (standard) | Stateless, secure tokens |
| **Version Control** | Git | Latest stable | Distributed, industry standard |
| **Package Manager** | pnpm | Latest stable | Fast, disk-efficient, monorepo support |
| **Monorepo Tool** | Turborepo | Latest stable | Build orchestration, caching |
| **IDE** | Visual Studio Code | Latest stable | Free, extensible, excellent TypeScript support |
| **Containerization** | Docker | Latest stable | Consistent environments, deployment |

Each component has been selected for a specific architectural reason rather than popularity alone.

---

## Frontend Technologies

### Flutter

**Purpose**: Cross-platform UI framework

**Version**: Latest stable release

**Selection Rationale**:
- Single codebase for Windows, Android, Web, iOS, macOS, Linux
- Hot reload for rapid development
- Strong typing with Dart
- Comprehensive widget library
- Excellent performance
- Growing ecosystem

**Responsibility**:
- Render user interface
- Handle user interaction
- Communicate with APIs
- Manage UI state
- Display data

**Not Responsible For**:
- Business logic
- Database access
- Security decisions
- Business rule enforcement

**Supported Platforms**:
- Windows Desktop (Active)
- Android Mobile (Active)
- Web (via Flutter Web, Active)
- iOS (Future)
- macOS (Future)
- Linux (Future)

### Dart

**Purpose**: Frontend programming language

**Version**: Latest stable release

**Selection Rationale**:
- Strong static typing prevents runtime errors
- Modern syntax and features
- Excellent tooling
- Hot reload for development
- High performance
- JIT and AOT compilation
- Null safety
- Excellent IDE integration

**Standard Practice**: All frontend code shall be Dart; no JavaScript or other languages.

---

## Backend Runtime

### Node.js

**Purpose**: Backend server runtime

**Version**: Latest LTS (Long Term Support) release

**Selection Rationale**:
- High performance for I/O-bound operations
- Large, mature ecosystem (npm, pnpm)
- Asynchronous event-driven architecture
- Excellent async/await support
- Single-threaded per process, scalable via clustering
- Cross-platform support
- Fast development iteration
- Excellent for REST APIs

**Responsibility**:
- Execute backend services
- Handle HTTP requests
- Manage database connections
- Coordinate business logic
- Run scheduled jobs

**Limitations**:
- CPU-heavy workloads should use workers or separate services
- Large array/object operations may block event loop
- Memory-constrained environments need careful management

**Scaling Strategy**:
- Horizontal scaling via multiple processes/containers
- Load balancing for request distribution
- Worker threads for CPU-intensive tasks

---

## Backend Language

### TypeScript

**Purpose**: Backend programming language

**Version**: Latest stable release

**Selection Rationale**:
- Static type checking prevents runtime errors
- Improved maintainability and refactoring
- Better IDE support and autocompletion
- Compile-time error detection
- Easier onboarding for new developers
- Large ecosystem of typed packages
- Strict mode enforcement

**Standard Practice**: 
- All production backend code must be TypeScript
- Plain JavaScript not permitted in production
- Strict mode enabled
- NoImplicitAny enabled

**Compiler Configuration**:
- Target: ES2020 or later
- Module: ESNext or CommonJS (consistent project-wide)
- Strict: true
- NoImplicitAny: true
- ResolveJsonModule: true

---

## Web Framework

### Fastify

**Purpose**: HTTP server framework

**Version**: Latest stable release

**Selection Rationale**:
- High performance (competitive with raw Node)
- Schema-based request/response validation
- Excellent TypeScript support
- Plugin architecture for modularity
- Built-in logging (Pino)
- Comprehensive middleware ecosystem
- Active maintenance and community
- Low overhead

**Responsibilities**:
- Expose REST APIs
- Validate incoming requests
- Handle authentication
- Enforce authorization
- Format responses
- Error handling

**Architecture**:
```
HTTP Request
    ↓
Fastify Router
    ↓
Authentication Plugin
    ↓
Authorization Plugin
    ↓
Validation (Zod Schema)
    ↓
Business Logic (Service Layer)
    ↓
Response Formatting
    ↓
HTTP Response
```

---

## Database

### PostgreSQL

**Purpose**: Primary relational database

**Version**: Latest stable release (14+)

**Selection Rationale**:
- ACID compliance ensures data integrity
- Strong transaction support for consistency
- Advanced indexing (B-tree, Hash, GiST, GIN, BRIN)
- JSON/JSONB support for flexible data
- Partitioning for handling large tables
- Row-level security (RLS) for multi-tenancy
- Full-text search capabilities
- Replication and high-availability features
- Mature ecosystem and tooling
- Enterprise reliability

**Responsibilities**:
- Persistent data storage
- Transaction management
- Constraint enforcement
- Referential integrity
- Query optimization
- Data backups

**Features Used**:
- ACID transactions
- Foreign key constraints
- Check constraints
- Unique constraints
- Indexes (B-tree, partial, expression)
- Row-Level Security (multi-tenant isolation)
- Sequences for ID generation
- Triggers (for audit logging)
- Stored procedures (minimal use)

**System of Record**: PostgreSQL is the single source of truth for all business data. No secondary database shall become system of record without formal ADR approval.

---

## Object-Relational Mapping

### Drizzle ORM

**Purpose**: Type-safe database access

**Version**: Latest stable release

**Selection Rationale**:
- Excellent TypeScript integration
- Type-safe SQL generation
- Explicit schema definition (not magic)
- Migration tooling
- High performance
- Small bundle size
- Works with PostgreSQL drivers
- Developer-friendly API

**Usage**:
- Define schemas in TypeScript
- Generate type-safe queries
- Migrations for schema changes
- Support for complex queries

**Example**:
```typescript
const sales_orders = pgTable('sales_orders', {
  id: uuid('id').primaryKey(),
  customerId: uuid('customer_id').notNull(),
  orderDate: timestamp('order_date').notNull(),
  totalAmount: decimal('total_amount', { precision: 12, scale: 2 }),
  createdAt: timestamp('created_at').defaultNow(),
});
```

**Direct SQL**: Direct SQL remains permissible for complex queries or performance-critical operations.

---

## Validation

### Zod

**Purpose**: Schema validation

**Version**: Latest stable release

**Selection Rationale**:
- TypeScript-first schema validation
- Runtime type checking
- Excellent error messages
- Composable schemas
- Works with Fastify schema validation
- Growing adoption
- Good performance

**Usage Areas**:
- API request validation
- API response validation
- DTO validation
- Configuration validation
- Environment variable validation

**Example**:
```typescript
const CreateOrderSchema = z.object({
  customerId: z.string().uuid(),
  items: z.array(z.object({
    itemId: z.string().uuid(),
    quantity: z.number().positive(),
  })),
});

type CreateOrderRequest = z.infer<typeof CreateOrderSchema>;
```

---

## Authentication

### JWT (JSON Web Tokens)

**Purpose**: Stateless authentication

**Technology**: Standard JWT format

**Characteristics**:
- Stateless: Server doesn't store sessions
- Scalable: No session state on server
- Secure: Cryptographically signed
- Self-contained: Token includes user info

**Responsibilities**:
- Authentication Service handles login, token generation
- Token validation on every request
- Refresh token rotation
- Session management
- Logout (token blacklist)

**Token Structure**:
- Header: Algorithm, token type
- Payload: User ID, tenant ID, permissions, issued-at, expiration
- Signature: HMAC or RSA signature

**Lifespan**:
- Access token: Short-lived (15-60 minutes)
- Refresh token: Long-lived (days/weeks)
- Refresh tokens rotated on each use (for security)

**TBD in Future Volumes**:
- MFA (Multi-Factor Authentication)
- OIDC (OpenID Connect) compatibility
- SAML support
- Device trust
- Token encryption (JWE)

---

## Development Tools

### Version Control

**Technology**: Git

**Purpose**: Source code management

**Standard Practices**:
- Distributed version control
- Commit messages follow conventions
- Branch strategy (main, develop, feature branches)
- Pull request reviews before merge

### Package Manager

**Technology**: pnpm

**Purpose**: Node.js package management

**Selection Rationale**:
- Faster than npm
- Disk space efficient (content-addressable store)
- Excellent monorepo support
- Lock file ensures reproducible builds
- Strict dependency resolution

**Usage**:
- `pnpm install` for dependency installation
- `pnpm add` for adding packages
- Monorepo support via workspaces

### Monorepo Orchestration

**Technology**: Turborepo

**Purpose**: Monorepo build orchestration

**Selection Rationale**:
- Build caching reduces build time
- Task graph execution for efficiency
- Workspace support for multi-package repos
- Incremental builds

**Usage**:
```bash
turbo run build     # Build all packages
turbo run test      # Run tests in all packages
turbo run lint      # Lint all packages
```

### IDE

**Technology**: Visual Studio Code

**Purpose**: Code editor and development environment

**Selection Rationale**:
- Free and open-source
- Excellent TypeScript support
- Large extension ecosystem
- Works across platforms
- Lightweight and fast
- Integrated debugging
- Git integration

**Recommended Extensions**:
- Dart (for Flutter/Dart code)
- Thunder Client or REST Client (for API testing)
- Docker (for container management)
- PostgreSQL (for database queries)

### Containerization

**Technology**: Docker

**Purpose**: Environment consistency and deployment

**Usage**:
- Dockerfile for backend image
- Docker Compose for local development
- Container registry for deployment images

---

## Technology Evolution & Governance

### Replacement Process

Core technology replacement requires:

1. **Architecture Review**: Justify why replacement is needed
2. **Proof of Concept**: Demonstrate solution works
3. **Performance Evaluation**: Benchmarks showing improvement
4. **Migration Strategy**: Plan for existing code transition
5. **Architecture Decision Record**: Document decision
6. **Approval by Architecture Review Board**: Required before commitment

### Technology Lifecycle

Technologies in the official stack have this typical lifecycle:

| Phase | Duration | Action |
|-------|----------|--------|
| **Active** | 3-5 years | Actively used, updates/patches applied |
| **Maintenance** | 1-2 years | No new features, security/critical fixes only |
| **Deprecated** | 6-12 months | New projects use replacement, old projects migrate |
| **End-of-Life** | | Removed from stack |

### Examples

- **Node.js**: Recommend LTS versions; support current + 2 LTS versions
- **PostgreSQL**: Support latest + 2 previous major versions
- **Flutter**: Support latest + 1 major version
- **TypeScript**: Keep within 1-2 major versions

---

## Technology Not Included

These technologies are explicitly not part of the stack:

| Technology | Rationale |
|-----------|-----------|
| **Alternative Databases** (MongoDB, MySQL) | PostgreSQL is system of record |
| **Java/Spring** | Node.js selected for backend |
| **React/Vue** | Flutter selected for frontend |
| **GraphQL** | REST APIs selected for simplicity |
| **Serverless Functions** | Traditional server architecture |
| **NoSQL** | Relational model required for ERP |

These can be adopted through ADRs if justified.

---

## Future Technology Decisions (Deferred)

The following technology decisions are deferred to future volumes or ADRs:

- **Test Frameworks**: Jest, Vitest, Mocha options
- **API Documentation**: OpenAPI/Swagger tooling
- **Message Queue**: Redis, RabbitMQ, AWS SQS
- **Caching**: Redis, Memcached
- **Search**: Elasticsearch, Typesense
- **Object Storage**: AWS S3, MinIO, Azure Blob
- **Monitoring**: Prometheus, Datadog, New Relic
- **Logging**: ELK Stack, Splunk, Cloud Logging
- **Tracing**: Jaeger, Datadog APM
- **Secrets Management**: HashiCorp Vault, AWS Secrets Manager
- **CI/CD Platform**: GitHub Actions, GitLab CI, Jenkins
- **Infrastructure-as-Code**: Terraform, CloudFormation
- **Container Orchestration**: Kubernetes, Docker Swarm
- **Identity Provider**: Auth0, Okta, Keycloak

---

## Technology Risk Assessment

### Stability Risk

| Technology | Risk Level | Mitigation |
|-----------|-----------|-----------|
| PostgreSQL | Low | Mature, 20+ years, strong community |
| Node.js | Low | Backed by OpenJS Foundation |
| TypeScript | Low | Backed by Microsoft, widely adopted |
| Flutter | Low-Medium | Growing maturity, backed by Google |
| Fastify | Medium | Active community, but smaller than Express |

### Vendor Lock-in Risk

All major technologies are open-source with community backing. No vendor lock-in concerns.

---

## Summary

The technology stack has been carefully selected to:
- Maximize maintainability
- Minimize unnecessary complexity
- Support long-term business requirements
- Provide scalability without redesign
- Reduce total cost of ownership
- Support modern development practices

Technology decisions are stable but not immutable. Changes require formal governance through Architecture Decision Records.

---

## Related Documents

- [Design Philosophy](../02-architecture/01-design-philosophy.md) — How selections align with principles
- [System Architecture](../02-architecture/02-system-architecture.md) — How technologies are used in layers
- [Technology Evolution](../00-overview/02-governance.md) — Governance of technology changes
- [Backend Architecture](../04-backend/README.md) — Detailed backend technology guidance
- [Frontend Architecture](./README.md) — Detailed frontend technology guidance
- [Database Architecture](../03-database/README.md) — Detailed database guidance
