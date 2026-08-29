# Navigation and Routing Implementation Plan

**Status:** IN PROGRESS  
**Scope:** Core Enterprise Flutter Web navigation/routing stabilization  
**Baseline:** `d82e3dc9f66546e753df4a27af5d70835d34b600`

## 1. Problem statement

The current Flutter frontend mixes a persistent `AppShell`, a conventional `MaterialApp` navigator, a global route-state notifier, and named-route navigation. This is sufficient for basic in-app navigation, but it does not provide a reliable browser navigation contract.

Observed/identified failure modes include:

- Browser back/forward can leave the application at `/` while the Flutter navigator expects an authenticated application route.
- Unknown-route rendering is used as a fallback instead of treating the browser URL as application state.
- Navigation state is duplicated between the navigator stack and `AppRouteState`.
- The persistent shell and route content have separate ownership boundaries, making it easy for a screen to accidentally recreate or duplicate shell UI.
- Route transitions and browser history are not one coherent state machine.
- Permission loading can occur at the route-content level, allowing a route to briefly render an authorization/loading state before the shell/navigation state has settled.
- Navigation items are coupled to permission/module filtering but do not have a single canonical route model.

## 2. Target behavior

The ERP shall use one canonical navigation state for authenticated web application navigation:

```text
Browser URL / in-app navigation
             ↓
      Route configuration
             ↓
   Persistent application shell
       ├── Sidebar
       ├── TopBar
       └── Content Navigator
             ↓
          Screen
```

The shell must be created once for an authenticated session. Changing a route changes only the content area; sidebar, top bar, profile controls, theme controls, and navigation state remain mounted.

Browser back/forward and sidebar/top-bar navigation must operate on the same route history.

## 3. Implementation strategy

### Phase A — Canonical route model

Create a single route configuration source containing:

- Path.
- Display title.
- Permission key.
- Module code.
- Screen builder.
- Whether the route requires authentication.
- Whether the route is a top-level navigation destination.

Existing route names will be retained wherever practical to avoid breaking deep links and screen-level `Navigator` calls.

### Phase B — Router 2.0 integration

Replace the current `MaterialApp` route-only approach with Flutter's `MaterialApp.router` and a repository-owned `RouteInformationParser` / `RouterDelegate` implementation.

Requirements:

- Parse browser paths into the canonical route configuration.
- Serialize in-app route changes back into browser history.
- Support browser back/forward.
- Preserve authenticated session state.
- Redirect unauthenticated users to `/login`.
- Redirect `/` to `/dashboard` after authentication.
- Render a controlled not-found screen for unsupported paths.

No third-party routing package is required for this phase.

### Phase C — Persistent shell

Move ownership of the content `Navigator` into the authenticated router while keeping `AppShell` responsible only for presentation of:

- Sidebar.
- TopBar.
- Profile/action area.
- Responsive drawer/collapsed navigation.

The content navigator remains mounted while routes change.

### Phase D — Navigation actions

Sidebar items shall navigate through the canonical router rather than directly owning route-stack semantics.

Requirements:

- Clicking a menu item changes only content.
- Current item is selected from canonical route state.
- Child routes select their parent menu item.
- Desktop collapsed sidebar remains functional.
- Mobile drawer closes after navigation.
- Re-clicking the active route does not create duplicate history entries.

### Phase E — Authorization integration

Frontend authorization remains UX-only; backend authorization remains authoritative.

Route guards shall:

1. Confirm authentication.
2. Ensure effective permissions are loaded when required.
3. Evaluate the route permission.
4. Render an application-level access-denied state when authorization is absent.

Navigation visibility and route authorization must use the same route metadata so they cannot drift independently.

### Phase F — Back/forward and refresh behavior

Verify:

- Direct navigation to `/dashboard`.
- Direct navigation to `/organizations`.
- Browser back from `/organizations` to `/dashboard`.
- Browser forward from `/dashboard` to `/organizations`.
- Refresh on an authenticated route.
- Refresh after session restoration.
- Unauthenticated access to protected routes.
- Unknown path handling.
- Child/detail route navigation and return.

## 4. Compatibility constraints

The implementation must not change:

- Backend APIs.
- Database schema.
- Authentication contract.
- Tenant discovery.
- RBAC semantics.
- Permission keys.
- Module enablement rules.
- Existing business-screen behavior.
- Responsive shell visual design except where required to support navigation.

Route arguments used by existing screens must continue to work. Where a browser URL cannot safely encode a required internal object identifier, the router shall preserve existing in-app navigation behavior and document the limitation rather than inventing a new identifier contract.

## 5. Test plan

### Unit/widget

- Route parser accepts supported paths.
- Route serializer emits canonical paths.
- Unknown paths resolve to controlled not-found behavior.
- Protected routes respect authentication/permission state.
- Sidebar selection follows child routes.
- Navigation callbacks do not duplicate the active route.

### Browser/E2E

At minimum test widths:

- 1440
- 1280
- 1024
- 900
- 768
- 600
- 480
- 390

At representative authenticated widths verify:

- Single sidebar.
- Single top bar.
- Content-only route changes.
- Clickable navigation.
- Browser back/forward.
- Refresh without unexpected logout.
- Profile section remains present.
- Dashboard data remains loaded.

## 6. Rollout sequence

1. Documentation and route contract update.
2. Introduce router/parser/delegate without changing backend behavior.
3. Move authenticated content navigation into the persistent shell.
4. Connect sidebar navigation to canonical routing.
5. Add route/authorization tests.
6. Run Flutter analyze/test/build.
7. Run authenticated browser navigation matrix.
8. Commit in small, reversible steps.

## 7. Definition of done

Navigation is complete when:

- The shell is mounted exactly once for authenticated pages.
- Sidebar and top bar remain mounted while screens change.
- Sidebar navigation is clickable at all supported responsive modes.
- Browser back/forward changes the same application route state as in-app navigation.
- Refreshing an authenticated route restores the session and route when the session is valid.
- `/` resolves deterministically instead of producing an unknown-route error.
- Unknown paths show a controlled not-found state.
- Permission-aware menus and route guards use one route metadata source.
- Existing authentication, tenant context, RBAC, module access, and business screens remain intact.
- Automated checks and representative browser verification pass.

## Cross References

- [Navigation Architecture](./07-navigation-architecture.md)
- [Flutter Architecture](./02-flutter-architecture.md)
- [Frontend Testing Strategy](./22-frontend-testing-strategy.md)
- [Frontend Development Standards](./23-development-standards.md)
- [Implementation Roadmap](../00-overview/03-implementation-roadmap.md)
