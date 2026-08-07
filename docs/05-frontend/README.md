# Frontend Architecture & Technology Stack

This directory contains frontend framework, technology selections, and client-side architecture standards.

## Documents Contained

1. **[Technology Stack Overview](./01-technology-stack.md)**: Complete technology selections and rationale

## From Volume 1

### Frontend Framework: Flutter

**Selection Rationale**: Flutter has been selected as the official frontend framework, enabling a single codebase to target multiple platforms:
- Windows Desktop
- Android Mobile
- Web Browser
- Future support: iOS, macOS, Linux

**Benefits**:
- Single codebase reduces maintenance effort
- Consistent user experience across platforms
- Hot Reload for development productivity
- Strong typing with Dart
- Excellent widget library

### Frontend Language: Dart

**Selection Rationale**: Dart has been selected as the frontend language due to:
- Strong typing preventing runtime errors
- Modern syntax and features
- Excellent tooling and IDE support
- High performance
- Hot Reload support for rapid development
- Excellent IDE integration (VS Code, IntelliJ)

**Standard**: All frontend code shall follow official Dart conventions.

### Frontend Responsibilities

The Frontend Layer is responsible for:
- **User Interface**: Rendering screens, forms, dialogs
- **User Interaction**: Handling user input and navigation
- **Data Presentation**: Formatting and displaying data
- **API Communication**: Calling backend APIs
- **User Experience Validation**: Form validation for UX feedback
- **Local State Management**: Managing UI state (not business state)

### Frontend NOT Responsible For

The Frontend Layer is explicitly NOT responsible for:
- **Database Access**: No direct database queries
- **Business Logic**: No financial calculations, inventory rules, approval logic
- **Authoritative Validation**: Cannot enforce business policies
- **Security Decisions**: No permission or authorization logic
- **Business Rules**: Rules live in backend

### UX vs. Business Validation

**Frontend UX Validation** (allowed):
```dart
if (quantity.isEmpty) {
  showError("Quantity is required");
}
if (!isNumeric(quantity)) {
  showError("Quantity must be a number");
}
```

**Backend Validation** (required):
```typescript
if (stock < requestedQuantity) {
  throw new InsufficientStockError();
}
if (customer.creditLimit < orderTotal) {
  throw new CreditLimitExceededError();
}
```

Frontend validation improves UX but never replaces backend validation.

### Supported Platforms

| Platform | Technology | Use Case | Status |
|----------|-----------|----------|--------|
| **Windows Desktop** | Flutter Desktop | Office workers, data entry | Active |
| **Web Browser** | Flutter Web | Remote access, any browser | Active |
| **Android Mobile** | Flutter Mobile | Field staff, warehouse, logistics | Active |
| **iOS** | Flutter iOS | Mobile users (future) | Roadmap |
| **macOS** | Flutter macOS | Developer community (future) | Roadmap |
| **Linux** | Flutter Linux | Advanced users (future) | Roadmap |

---

## Development Environment

### Official Toolchain

The official development environment consists of:

| Tool | Purpose |
|------|---------|
| **Visual Studio Code** | IDE for development |
| **Dart SDK** | Language runtime and tooling |
| **Flutter SDK** | Framework and widgets |
| **Git** | Version control |

Every developer shall use the same baseline toolchain to reduce environment-specific issues.

### Code Standards

Frontend code should:
- Follow Dart Style Guide
- Use meaningful variable and function names
- Include documentation for public APIs
- Follow MVC or MVVM patterns
- Use dependency injection for testability
- Implement error handling

---

## Related Documentation

- [System Architecture](../02-architecture/02-system-architecture.md) — Client Layer description
- [Design Philosophy](../02-architecture/01-design-philosophy.md) — Frontend as presentation only
- [Volume 4 — Frontend Architecture](../../Enterprise%20ERP%20Software%20Architecture-%20Volume%204%20–%20Frontend%20Architecture.md) — Detailed frontend standards

## Navigation

This volume (Volume 1) provides architectural principles for frontend design. See **Volume 4** for:
- Component architecture and patterns
- State management strategies
- Navigation and routing
- API client patterns
- Error handling standards
- Testing strategies
- Responsive design guidelines
- Accessibility standards
- Offline capability design (if applicable)
- Platform-specific considerations
