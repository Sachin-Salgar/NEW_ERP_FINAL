# Navigation and Routing Implementation Plan

**Status:** IMPLEMENTED — VALIDATION PENDING  
**Scope:** Core Enterprise Flutter Web navigation/routing stabilization  
**Baseline:** `d82e3dc9f66546e753df4a27af5d70835d34b600`

## 1. Problem statement

The current Flutter frontend mixed a persistent `AppShell`, a conventional `MaterialApp` navigator, a global route-state notifier, and named-route navigation. This was sufficient for basic navigation but did not provide a reliable browser navigation contract.

Observed failure modes included browser back/forward desynchronization, unknown-route fallbacks, duplicated route metadata, shell ownership confusion, permission-loading races, and navigation items drifting from route authorization.

## 2. Target behavior

The ERP uses one authenticated shell boundary for web application navigation:

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

The shell is created once for an authenticated session. Changing a route changes only the content navigator; sidebar, top bar, profile controls, theme controls, and navigation state remain mounted.

## 3. Implementation status

### Phase A — Canonical route model — IMPLEMENTED

`frontend/lib/routing/route_config.dart` is the canonical metadata source for top-level navigation. It contains:

- Path.
- Display title.
- Permission key.
- Module code.
- Icon.
- Navigation group.
- Route matching/normalization helpers.
- Canonical top-level route selection.
- Route permission metadata for child routes.

Sidebar visibility, shell titles/selection, and route permission metadata now consume this shared model.

### Phase B — Router 2.0 integration — IMPLEMENTED

`MaterialApp.router` owns `AppRouterDelegate` and `AppRouteInformationParser`.

Implemented behavior:

- Browser paths are parsed into normalized application paths.
- In-app content navigation updates the delegate configuration and browser URL.
- Browser route changes are applied to the persistent content navigator.
- `/` normalizes to `/dashboard`.
- `/login` is the unauthenticated boundary.
- Protected application paths remain behind the authenticated shell.
- Unsupported paths render a controlled page-not-found screen instead of the previous generic unknown-route fallback.

### Phase C — Persistent shell — IMPLEMENTED

`AppRouterDelegate` owns the authenticated shell boundary. `AppShell` owns presentation only, while its supplied content navigator owns screen transitions.

Sidebar and TopBar therefore remain mounted while authenticated content changes.

### Phase D — Navigation actions — IMPLEMENTED

Sidebar navigation now uses canonical route metadata and calls the persistent content navigator. Child/detail routes select their parent top-level item through route-prefix matching.

Desktop collapsed navigation remains clickable. Mobile drawer navigation closes before changing the content route. Re-selecting the active route does not push another route.

### Phase E — Authorization integration — IMPLEMENTED

Frontend authorization remains UX-only and backend authorization remains authoritative.

Protected routes use the existing AuthService/AuthZ state. Permission loading waits for an already-running authorization refresh rather than starting competing requests. Existing authorization state is preserved during refresh/failure so navigation does not temporarily become forbidden merely because a refresh is in flight.

Navigation visibility and top-level route selection now consume the same route metadata source.

### Phase F — Back/forward and refresh behavior — IMPLEMENTED, VALIDATION PENDING

The Router 2.0 delegate/parser contract and persistent content navigator are implemented. CI now provides real Chrome browser execution for the existing admin and limited-user E2E scenarios. The broader browser matrix remains a separate release gate.

## 4. Compatibility constraints

The implementation does not change backend APIs, database schema, authentication contract, tenant discovery, RBAC semantics, permission keys, module enablement rules, or business-screen behavior.

Existing named screen routes remain available through `AppRouter.generateRoute`. Routes that depend on in-app object arguments continue to use the existing argument mechanism; safe browser deep-link identifiers for those internal object routes have not been invented.

## 5. Test plan

### Unit/widget

Implemented coverage includes canonical route normalization, child-to-parent route selection, metadata/permission/module consistency, and unknown-route metadata fallback.

Remaining automated verification should include:

- Route parser accepts supported paths.
- Route serializer emits canonical paths.
- Unknown paths resolve to controlled not-found behavior.
- Protected routes respect authentication/permission state.
- Sidebar selection follows child routes.
- Navigation callbacks do not duplicate the active route.

### Browser/E2E

The repository now has deterministic CI browser execution using Flutter Web, ChromeDriver, and a locally started Postgres-backed API. GitHub Actions run **33486274877** completed successfully on `main` commit `8dd4d17edd3f050a66c1bd2c25e47597fda21a95`, including:

- **Run admin E2E test — success**
- **Run limited-user E2E test — success**

These scenarios provide authoritative CI evidence for the existing authenticated login/dashboard flows against the repository-controlled backend and database.

They do **not** by themselves prove the complete browser navigation matrix below. The remaining matrix must cover widths:

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

1. Documentation and route contract update — COMPLETE.
2. Introduce router/parser/delegate — COMPLETE.
3. Move authenticated content navigation into the persistent shell — COMPLETE.
4. Connect sidebar navigation to canonical routing — COMPLETE.
5. Add route/authorization tests — IMPLEMENTED; validated by repository tests and CI execution for the current E2E scenarios.
6. Run Flutter analyze/test/build — VALIDATION PENDING for the final release gate.
7. Run authenticated browser navigation matrix — PARTIALLY VALIDATED; admin and limited-user login/dashboard E2E pass in CI, while the broader navigation matrix remains.
8. Commit in small, reversible steps — COMPLETE for the current implementation sequence.

## 7. Definition of done

Implementation requirements are complete. Release completion remains gated by actual validation evidence:

- [x] Shell mounted exactly once for authenticated pages.
- [x] Sidebar/top bar remain mounted while screens change.
- [x] Sidebar navigation uses canonical route metadata.
- [x] Desktop/mobile navigation actions target the persistent content navigator.
- [x] Browser URL parsing/serialization is owned by Router 2.0.
- [x] `/` resolves deterministically to dashboard for authenticated navigation.
- [x] Unsupported paths render a controlled not-found state.
- [x] Permission-aware menus and route guards use shared route metadata for their route contract.
- [x] Authorization refresh no longer causes a competing route-level permission load.
- [x] Deterministic CI browser runner executes the existing admin and limited-user Flutter Web E2E scenarios successfully.
- [ ] Browser back/forward matrix verified.
- [ ] Authenticated refresh/session restoration matrix verified.
- [ ] Representative responsive browser matrix verified.
- [ ] Full automated validation gates pass.
- [ ] Final security/Core Enterprise audit completed.

## Cross References

- [Navigation Architecture](./07-navigation-architecture.md)
- [Flutter Architecture](./02-flutter-architecture.md)
- [Frontend Testing Strategy](./22-frontend-testing-strategy.md)
- [Frontend Development Standards](./23-development-standards.md)
- [Implementation Roadmap](../00-overview/03-implementation-roadmap.md)
