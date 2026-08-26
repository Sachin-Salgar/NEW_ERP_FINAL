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

void _dumpPendingExceptions(WidgetTester tester, String stage) {
  var index = 0;
  while (true) {
    final exception = tester.takeException();
    if (exception == null) {
      break;
    }
    index += 1;
    debugPrint('E2E PENDING EXCEPTION [$stage #$index]: $exception');
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
      final baseUrl = const String.fromEnvironment(
        'API_BASE_URL',
        defaultValue: 'http://localhost:3000',
      );

      await tester.pumpWidget(const App());
      _dumpPendingExceptions(tester, 'after pumpWidget');
      await tester.pumpAndSettle(const Duration(seconds: 10));
      _dumpPendingExceptions(tester, 'after initial pumpAndSettle');

      expect(
        find.byKey(const ValueKey('login_identifier_field')),
        findsOneWidget,
        reason: 'The tenant bootstrap should leave an unauthenticated user on the login screen.',
      );

      await tester.enterText(find.byKey(const ValueKey('login_identifier_field')), _adminEmail);
      await tester.enterText(find.byKey(const ValueKey('login_password_field')), _adminPassword);
      await tester.tap(find.byKey(const ValueKey('login_submit_button')));
      await tester.pumpAndSettle(const Duration(seconds: 15));
      _dumpPendingExceptions(tester, 'after login pumpAndSettle');

      expect(find.text('Dashboard'), findsOneWidget);

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
