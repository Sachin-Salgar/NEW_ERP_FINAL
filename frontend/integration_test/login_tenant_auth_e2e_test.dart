import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:http/http.dart' as http;
import 'package:integration_test/integration_test.dart';
import 'package:flutter/material.dart';

import 'package:new_erp_final_frontend/app/app.dart';
import 'package:new_erp_final_frontend/core/auth/auth_service.dart';

const _tenantId = '11111111-1111-4111-8111-111111111111';
const _organizationId = '22222222-2222-4222-8222-222222222222';
const _adminEmail = 'e2e@example.com';
const _adminPassword = 'Password123!';
const _limitedEmail = 'e2e-limited@example.com';
const _moduleCode = 'e2e-rbac';

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

Future<void> _settle(WidgetTester tester) async {
  await tester.pumpAndSettle(
    const Duration(milliseconds: 100),
    timeout: const Duration(seconds: 30),
  );
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

    testWidgets('admin login follows tenant, organization, location, module and permission flow', (tester) async {
      final baseUrl = const String.fromEnvironment(
        'API_BASE_URL',
        defaultValue: 'http://localhost:3000',
      );

      await tester.pumpWidget(const App());
      _dumpPendingExceptions(tester, 'after pumpWidget');
      await _settle(tester);
      _dumpPendingExceptions(tester, 'after initial pumpAndSettle');

      expect(
        find.byKey(const ValueKey('login_identifier_field')),
        findsOneWidget,
        reason: 'The tenant bootstrap should leave an unauthenticated user on the login screen.',
      );

      await tester.enterText(find.byKey(const ValueKey('login_identifier_field')), _adminEmail);
      await tester.enterText(find.byKey(const ValueKey('login_password_field')), _adminPassword);
      await tester.tap(find.byKey(const ValueKey('login_submit_button')));
      await _settle(tester);
      _dumpPendingExceptions(tester, 'after login pumpAndSettle');

      expect(find.text('Select organization'), findsOneWidget);

      final authBeforeOrganization = GetIt.instance.get<AuthService>();
      expect(authBeforeOrganization.isAuthenticated, isTrue);
      expect(authBeforeOrganization.currentTenantId, equals(_tenantId));
      expect(authBeforeOrganization.currentOrganizationId, isNull);
      expect(authBeforeOrganization.requiresOrganizationSelection, isTrue);

      await tester.tap(find.text('E2E Organization').first);
      await _settle(tester);
      _dumpPendingExceptions(tester, 'after organization selection');

      expect(find.text('Select location'), findsOneWidget);

      final authBeforeLocation = GetIt.instance.get<AuthService>();
      expect(authBeforeLocation.currentOrganizationId, equals(_organizationId));
      expect(authBeforeLocation.requiresOrganizationSelection, isFalse);
      expect(authBeforeLocation.requiresLocationSelection, isTrue);
      expect(authBeforeLocation.availableLocations.length, equals(2));

      await tester.tap(find.text('E2E Main Location').first);
      await _settle(tester);
      _dumpPendingExceptions(tester, 'after location selection');

      expect(find.text('Dashboard'), findsOneWidget);

      final auth = GetIt.instance.get<AuthService>();
      expect(auth.isAuthenticated, isTrue);
      expect(auth.currentTenantId, equals(_tenantId));
      expect(auth.currentOrganizationId, equals(_organizationId));
      expect(auth.currentLocationId, isNotNull);
      expect(auth.requiresOrganizationSelection, isFalse);
      expect(auth.requiresLocationSelection, isFalse);

      final String? uiToken = auth.accessToken;
      expect(uiToken, isNotNull, reason: 'UI must have access token after login');

      Future<Map<String, dynamic>> fetchModules() async {
        final response = await http.get(
          Uri.parse(baseUrl + '/api/v1/auth/modules'),
          headers: {
            'Authorization': 'Bearer ' + uiToken!,
            'x-tenant-id': _tenantId,
          },
        );
        expect(response.statusCode, 200);
        return jsonDecode(response.body) as Map<String, dynamic>;
      }

      var modulesBody = await fetchModules();
      var modules = (modulesBody['modules'] as List<dynamic>?) ?? const [];
      expect(
        modules.any((module) => (module as Map<String, dynamic>)['code'] == _moduleCode),
        isTrue,
        reason: 'The E2E module must be enabled for the selected organization before authorization is evaluated.',
      );

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
        reason: 'The authenticated admin should be able to read roles while the required module is enabled.',
      );

      final disableModuleResponse = await http.post(
        Uri.parse(baseUrl + '/api/v1/auth/modules/' + _moduleCode + '/disable'),
        headers: {
          'Authorization': 'Bearer ' + uiToken!,
          'x-tenant-id': _tenantId,
        },
      );
      expect(disableModuleResponse.statusCode, 200);

      modulesBody = await fetchModules();
      modules = (modulesBody['modules'] as List<dynamic>?) ?? const [];
      expect(
        modules.any((module) => (module as Map<String, dynamic>)['code'] == _moduleCode),
        isFalse,
        reason: 'A disabled organization module must disappear from accessible module discovery.',
      );

      final deniedRoleAccess = await http.get(
        Uri.parse(baseUrl + '/api/v1/rbac/roles'),
        headers: {
          'Authorization': 'Bearer ' + uiToken!,
          'x-tenant-id': _tenantId,
        },
      );
      expect(
        deniedRoleAccess.statusCode,
        403,
        reason: 'Permission alone must not grant access when the organization module is disabled.',
      );

      final enableModuleResponse = await http.post(
        Uri.parse(baseUrl + '/api/v1/auth/modules/' + _moduleCode + '/enable'),
        headers: {
          'Authorization': 'Bearer ' + uiToken!,
          'x-tenant-id': _tenantId,
        },
      );
      expect(enableModuleResponse.statusCode, 200);

      modulesBody = await fetchModules();
      modules = (modulesBody['modules'] as List<dynamic>?) ?? const [];
      expect(
        modules.any((module) => (module as Map<String, dynamic>)['code'] == _moduleCode),
        isTrue,
        reason: 'Re-enabling the organization module must restore module discovery.',
      );

      final restoredRoleAccess = await http.get(
        Uri.parse(baseUrl + '/api/v1/rbac/roles'),
        headers: {
          'Authorization': 'Bearer ' + uiToken!,
          'x-tenant-id': _tenantId,
        },
      );
      expect(restoredRoleAccess.statusCode, 200);

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

      final deniedRoleAccessForLimitedUser = await http.get(
        Uri.parse(baseUrl + '/api/v1/rbac/roles'),
        headers: {
          'Authorization': 'Bearer ' + limitedToken!,
          'x-tenant-id': _tenantId,
        },
      );
      expect(
        deniedRoleAccessForLimitedUser.statusCode,
        403,
        reason: 'A user without role.read permission must not access the protected RBAC listing.',
      );
    });
  });
}
