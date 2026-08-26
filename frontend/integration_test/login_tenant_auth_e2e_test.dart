import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:http/http.dart' as http;
import 'package:integration_test/integration_test.dart';
import 'package:flutter/material.dart';

import 'package:new_erp_final_frontend/app/app.dart';
import 'package:new_erp_final_frontend/core/auth/auth_service.dart';

const _tenantId = '11111111-1111-4111-8111-111111111111';
const _adminEmail = 'e2e@example.com';
const _adminPassword = 'Password123!';
const _limitedEmail = 'e2e-limited@example.com';

Future<void> _waitForFinder(
  WidgetTester tester,
  Finder finder, {
  Duration timeout = const Duration(seconds: 30),
}) async {
  final deadline = DateTime.now().add(timeout);
  while (DateTime.now().isBefore(deadline)) {
    if (finder.evaluate().isNotEmpty) {
      return;
    }
    await tester.pump(const Duration(milliseconds: 100));
  }

  expect(
    finder,
    findsOneWidget,
    reason: 'Timed out waiting for the expected UI element.',
  );
}

Future<void> _drainTestExceptions(WidgetTester tester, String checkpoint) async {
  for (var i = 0; i < 50; i++) {
    final exception = tester.takeException();
    if (exception == null) {
      return;
    }
    debugPrint('E2E TEST EXCEPTION [$checkpoint] #${i + 1}: $exception');
  }
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('E2E login and authorization flow', () {
    setUp(() async {
      await GetIt.instance.reset();
      await App.init();
    });

    tearDown(() async {
      await GetIt.instance.reset();
    });

    testWidgets('admin login establishes tenant context and backend authorization is enforced', (tester) async {
      final previousFlutterErrorHandler = FlutterError.onError;
      FlutterError.onError = (details) {
        debugPrint('E2E FLUTTER ERROR: ${details.exception}');
        if (details.stack != null) {
          debugPrintStack(stackTrace: details.stack);
        }
        previousFlutterErrorHandler?.call(details);
      };

      addTearDown(() {
        FlutterError.onError = previousFlutterErrorHandler;
      });

      final baseUrl = const String.fromEnvironment(
        'API_BASE_URL',
        defaultValue: 'http://localhost:3000',
      );

      await tester.pumpWidget(const App());
      await tester.pump(const Duration(milliseconds: 100));
      await _drainTestExceptions(tester, 'initial-render');

      final loginIdentifierField = find.byKey(const ValueKey('login_identifier_field'));
      final loginPasswordField = find.byKey(const ValueKey('login_password_field'));
      final loginSubmitButton = find.byKey(const ValueKey('login_submit_button'));

      await _waitForFinder(tester, find.text('Welcome back'));
      await _waitForFinder(tester, loginIdentifierField);
      await _waitForFinder(tester, loginPasswordField);
      await _waitForFinder(tester, loginSubmitButton);

      await tester.enterText(loginIdentifierField, _adminEmail);
      await tester.enterText(loginPasswordField, _adminPassword);
      await tester.tap(loginSubmitButton);
      await _drainTestExceptions(tester, 'after-login-tap');

      await _waitForFinder(tester, find.text('Dashboard'));
      await _drainTestExceptions(tester, 'dashboard-visible');

      final auth = GetIt.instance.get<AuthService>();
      expect(auth.isAuthenticated, isTrue);
      expect(auth.currentTenantId, equals(_tenantId));

      final String? uiToken = auth.accessToken;
      expect(uiToken, isNotNull, reason: 'UI must have access token after login');

      final protectedRolesResponse = await http.get(
        Uri.parse(baseUrl + '/api/v1/rbac/roles'),
        headers: {
          'Authorization': 'Bearer ' + uiToken!,
          'x-tenant-id': _tenantId,
        },
      );
      expect(
        protectedRolesResponse.statusCode,
        200,
        reason: 'The authenticated admin should be able to read roles in the tenant.',
      );

      final mismatchedTenantResponse = await http.get(
        Uri.parse(baseUrl + '/api/v1/rbac/roles'),
        headers: {
          'Authorization': 'Bearer ' + uiToken!,
          'x-tenant-id': '11111111-1111-4111-8111-111111111112',
        },
      );
      expect(
        mismatchedTenantResponse.statusCode,
        401,
        reason: 'A mismatched tenant header must be rejected by the backend.',
      );

      final limitedLoginResponse = await http.post(
        Uri.parse(baseUrl + '/api/v1/auth/login'),
        headers: {
          'x-tenant-id': _tenantId,
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'identifier': _limitedEmail,
          'password': _adminPassword,
        }),
      );
      expect(
        limitedLoginResponse.statusCode,
        200,
        reason: 'The limited E2E user should still authenticate in the same tenant.',
      );

      final limitedBody = jsonDecode(limitedLoginResponse.body) as Map<String, dynamic>;
      final limitedToken = limitedBody['accessToken'] as String?;
      expect(limitedToken, isNotNull, reason: 'Limited-user login must return an access token');

      final deniedRoleAccess = await http.get(
        Uri.parse(baseUrl + '/api/v1/rbac/roles'),
        headers: {
          'Authorization': 'Bearer ' + limitedToken!,
          'x-tenant-id': _tenantId,
        },
      );
      expect(
        deniedRoleAccess.statusCode,
        403,
        reason: 'A user without role.read permission must not access the protected RBAC listing.',
      );
    });
  });
}
