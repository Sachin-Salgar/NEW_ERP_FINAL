import 'package:flutter/material.dart';
import 'package:web/web.dart' as web;
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:integration_test/integration_test.dart';

import 'package:new_erp_final_frontend/app/app.dart';
import 'package:new_erp_final_frontend/core/auth/auth_service.dart';
import 'package:new_erp_final_frontend/modules/auth/login_screen.dart';
import 'package:new_erp_final_frontend/modules/dashboard/dashboard_screen.dart';
import 'package:new_erp_final_frontend/presentation/ui/components/settings_sidebar.dart';
import 'package:new_erp_final_frontend/routing/app_router_delegate.dart';
import 'package:new_erp_final_frontend/routing/route_state.dart';

const _tenantId = '11111111-1111-4111-8111-111111111111';
const _branchId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const _adminEmail = 'e2e@example.com';
const _adminPassword = 'Password123!';
const _limitedEmail = 'e2e-limited@example.com';
const _limitedPassword = 'Password123!';

Future<void> _waitFor(
  WidgetTester tester,
  Finder finder, {
  Duration timeout = const Duration(seconds: 30),
}) async {
  final deadline = DateTime.now().add(timeout);
  while (DateTime.now().isBefore(deadline)) {
    await tester.pump(const Duration(milliseconds: 100));
    if (finder.evaluate().isNotEmpty) return;
  }
  final auth = GetIt.instance.isRegistered<AuthService>()
      ? GetIt.instance.get<AuthService>()
      : null;
  final diagnostics = <String>[
    'currentRoute=${AppRouteState.currentRoute.value}',
    'authenticated=${auth?.isAuthenticated}',
    'tenantId=${auth?.currentTenantId}',
    'branchRead=${auth?.hasPermission('branch.read')}',
    'branchManage=${auth?.hasPermission('branch.update')}',
    'branchNotFound=${find.text('Branch not found').evaluate().length}',
    'accessDenied=${find.text('Access denied').evaluate().length}',
    'visibleBranchInfo=${find.text('Branch information').evaluate().length}',
  ];
  fail('Timed out waiting for finder: $finder (${diagnostics.join(', ')})');
}

Future<void> _settle(WidgetTester tester) async {
  for (var i = 0; i < 20; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

Future<void> _resetBrowserTestState() async {
  web.window.localStorage.clear();
  web.window.sessionStorage.clear();
}

Future<void> _login(WidgetTester tester, String email, String password) async {
  await _waitFor(tester, find.byKey(const ValueKey('login_identifier_field')));
  await tester.enterText(
    find.byKey(const ValueKey('login_identifier_field')),
    email,
  );
  await tester.enterText(
    find.byKey(const ValueKey('login_password_field')),
    password,
  );
  await tester.tap(find.byKey(const ValueKey('login_submit_button')));
  await _settle(tester);
}

Future<AppRouterDelegate> _routerDelegate(WidgetTester tester) async {
  Finder contextFinder = find.byType(DashboardScreen);
  if (contextFinder.evaluate().isEmpty)
    contextFinder = find.byType(SettingsSidebar);
  if (contextFinder.evaluate().isEmpty)
    contextFinder = find.byType(LoginScreen);
  await _waitFor(tester, contextFinder);
  final context = tester.element(contextFinder.first);
  final delegate = Router.of(context).routerDelegate;
  if (delegate is! AppRouterDelegate) {
    fail('Router delegate is not AppRouterDelegate: ${delegate.runtimeType}');
  }
  return delegate;
}

Future<void> _openRoute(WidgetTester tester, String route) async {
  final delegate = await _routerDelegate(tester);
  delegate.navigate(route);
  await _settle(tester);
  await _waitFor(tester, _routeContentFinder(route));
  expect(AppRouteState.currentRoute.value, equals(route));
}

Finder _routeContentFinder(String route) {
  if (route.contains('/branches/details/'))
    return find.text('Branch information');
  if (route == '/settings/users') return find.text('Users');
  if (route == '/settings/roles' || route == '/settings/permissions')
    return find.text('Access denied');
  if (route == '/settings/branches') return find.text('Branches');
  return find.text('Branches');
}

Future<void> _logout(WidgetTester tester) async {
  await tester.tap(find.byTooltip('Profile'));
  await _settle(tester);
  await tester.tap(find.text('Logout').last);
  await _settle(tester);
}

Future<void> _browserBack(WidgetTester tester, String expectedRoute) async {
  web.window.history.back();
  await _waitFor(tester, _routeContentFinder(expectedRoute));
  expect(AppRouteState.currentRoute.value, equals(expectedRoute));
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  final previousTestExceptionReporter = reportTestException;
  reportTestException = (details, testDescription) {
    if (details.exception.toString().contains(
      'A FocusManager was used after being disposed.',
    )) {
      return;
    }
    previousTestExceptionReporter(details, testDescription);
  };

  testWidgets(
    'admin browser navigation matrix validates shell, settings, detail routes, history and protected routing',
    (tester) async {
      await _resetBrowserTestState();
      await GetIt.instance.reset();
      await App.init();
      await tester.pumpWidget(const App());
      await _login(tester, _adminEmail, _adminPassword);
      await _waitFor(tester, find.byType(DashboardScreen));
      expect(AppRouteState.currentRoute.value, equals('/dashboard'));
      expect(find.text('Dashboard'), findsNWidgets(2));

      final auth = GetIt.instance.get<AuthService>();
      expect(auth.isAuthenticated, isTrue);
      expect(auth.currentTenantId, equals(_tenantId));
      expect(auth.currentTenantId, equals(_tenantId));

      await _openRoute(tester, '/settings');
      await _waitFor(tester, find.text('Branches'));
      expect(find.byType(SettingsSidebar), findsOneWidget);
      final branchesSidebarTarget = find.descendant(
        of: find.byType(SettingsSidebar),
        matching: find.widgetWithText(InkWell, 'Branches'),
      );
      expect(branchesSidebarTarget, findsOneWidget);
      await tester.tap(branchesSidebarTarget);
      await _settle(tester);
      await _waitFor(tester, find.text('Branches'));
      expect(AppRouteState.currentRoute.value, equals('/settings/branches'));
      expect(find.text('Branches'), findsWidgets);

      await _openRoute(tester, '/settings/branches/details/$_branchId');
      await _waitFor(tester, find.text('Branch information'));
      expect(find.text('E2E Main Branch'), findsWidgets);

      await _browserBack(tester, '/settings/branches/details/$_branchId');
      expect(find.text('E2E Main Branch'), findsWidgets);

      await _logout(tester);
      await _waitFor(
        tester,
        find.byKey(const ValueKey('login_identifier_field')),
      );
      final loginDelegate = await _routerDelegate(tester);
      await loginDelegate.setNewRoutePath('/settings/branches');
      await _settle(tester);
      await _waitFor(
        tester,
        find.byKey(const ValueKey('login_identifier_field')),
      );
      expect(AppRouteState.currentRoute.value, equals('/login'));
      expect(find.text('Dashboard'), findsNothing);
      await _login(tester, _limitedEmail, _limitedPassword);
      await _waitFor(tester, find.byType(DashboardScreen));
      expect(AppRouteState.currentRoute.value, equals('/dashboard'));

      final limitedAuth = GetIt.instance.get<AuthService>();
      expect(limitedAuth.isAuthenticated, isTrue);
      expect(limitedAuth.currentTenantId, equals(_tenantId));
      expect(limitedAuth.currentTenantId, equals(_tenantId));

      await _openRoute(tester, '/settings/branches');
      await _waitFor(tester, find.text('Branches'));
      expect(find.text('Branches'), findsWidgets);
      await _openRoute(tester, '/settings/users');
      await _waitFor(tester, find.text('Users'));
      expect(find.text('Users'), findsWidgets);
      await _openRoute(tester, '/settings/roles');
      await _waitFor(tester, find.text('Access denied'));
      expect(find.text('Required permission: role.read.'), findsOneWidget);
      await _openRoute(tester, '/settings/permissions');
      await _waitFor(tester, find.text('Access denied'));
      expect(
        find.text('Required permission: permission.read.'),
        findsOneWidget,
      );
    },
    timeout: const Timeout(Duration(seconds: 120)),
  );
}
