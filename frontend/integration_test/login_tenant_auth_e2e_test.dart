import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:http/http.dart' as http;
import 'package:integration_test/integration_test.dart';

import 'package:new_erp_final_frontend/app/app.dart';
import 'package:new_erp_final_frontend/core/auth/auth_service.dart';

const _tenantId = '11111111-1111-4111-8111-111111111111';
const _organizationId = '22222222-2222-4222-8222-222222222222';
const _adminEmail = 'e2e@example.com';
const _adminPassword = 'Password123!';
const _limitedEmail = 'e2e-limited@example.com';
const _moduleCode = 'e2e-rbac';

Future<void> _settle(WidgetTester tester) async {
  await tester.pumpAndSettle(const Duration(milliseconds: 100), EnginePhase.sendSemanticsUpdate, const Duration(seconds: 30));
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('E2E login and authorization flow', () {
    setUp(() async {
      await GetIt.instance.reset();
      await App.init();
    });

    tearDown(() async => GetIt.instance.reset());

    testWidgets('admin login goes directly to dashboard with tenant and default working context', (tester) async {
      final baseUrl = const String.fromEnvironment('API_BASE_URL', defaultValue: 'http://localhost:3000');

      await tester.pumpWidget(const App());
      await _settle(tester);
      expect(find.byKey(const ValueKey('login_identifier_field')), findsOneWidget);

      await tester.enterText(find.byKey(const ValueKey('login_identifier_field')), _adminEmail);
      await tester.enterText(find.byKey(const ValueKey('login_password_field')), _adminPassword);
      await tester.tap(find.byKey(const ValueKey('login_submit_button')));
      await _settle(tester);

      // Authentication must never send the user to an organization/location selection screen.
      expect(find.text('Select organization'), findsNothing);
      expect(find.text('Select location'), findsNothing);
      expect(find.text('Dashboard'), findsOneWidget);

      final auth = GetIt.instance.get<AuthService>();
      expect(auth.isAuthenticated, isTrue);
      expect(auth.currentTenantId, equals(_tenantId));
      expect(auth.currentOrganizationId, equals(_organizationId));
      expect(auth.requiresOrganizationSelection, isFalse);
      expect(auth.requiresLocationSelection, isFalse);

      // Location is optional working context; login must not be blocked if no user default exists.
      expect(auth.availableLocations.length, equals(2));

      final token = auth.accessToken;
      expect(token, isNotNull);

      Future<Map<String, dynamic>> fetchModules() async {
        final response = await http.get(Uri.parse('$baseUrl/api/v1/auth/modules'), headers: {'Authorization': 'Bearer $token', 'x-tenant-id': _tenantId});
        expect(response.statusCode, 200);
        return jsonDecode(response.body) as Map<String, dynamic>;
      }

      var modulesBody = await fetchModules();
      var modules = (modulesBody['modules'] as List<dynamic>?) ?? const [];
      expect(modules.any((m) => (m as Map<String, dynamic>)['code'] == _moduleCode), isTrue);

      final protectedRoles = await http.get(Uri.parse('$baseUrl/api/v1/rbac/roles'), headers: {'Authorization': 'Bearer $token', 'x-tenant-id': _tenantId});
      expect(protectedRoles.statusCode, 200);

      final disable = await http.post(Uri.parse('$baseUrl/api/v1/auth/modules/$_moduleCode/disable'), headers: {'Authorization': 'Bearer $token', 'x-tenant-id': _tenantId});
      expect(disable.statusCode, 200);
      modulesBody = await fetchModules();
      modules = (modulesBody['modules'] as List<dynamic>?) ?? const [];
      expect(modules.any((m) => (m as Map<String, dynamic>)['code'] == _moduleCode), isFalse);

      final denied = await http.get(Uri.parse('$baseUrl/api/v1/rbac/roles'), headers: {'Authorization': 'Bearer $token', 'x-tenant-id': _tenantId});
      expect(denied.statusCode, 403);

      final enable = await http.post(Uri.parse('$baseUrl/api/v1/auth/modules/$_moduleCode/enable'), headers: {'Authorization': 'Bearer $token', 'x-tenant-id': _tenantId});
      expect(enable.statusCode, 200);

      modulesBody = await fetchModules();
      modules = (modulesBody['modules'] as List<dynamic>?) ?? const [];
      expect(modules.any((m) => (m as Map<String, dynamic>)['code'] == _moduleCode), isTrue);

      final restored = await http.get(Uri.parse('$baseUrl/api/v1/rbac/roles'), headers: {'Authorization': 'Bearer $token', 'x-tenant-id': _tenantId});
      expect(restored.statusCode, 200);

      final mismatchedTenant = await http.get(Uri.parse('$baseUrl/api/v1/rbac/roles'), headers: {'Authorization': 'Bearer $token', 'x-tenant-id': '11111111-1111-4111-8111-111111111112'});
      expect(mismatchedTenant.statusCode, 401);

      final limitedLogin = await http.post(Uri.parse('$baseUrl/api/v1/auth/login'), headers: {'Content-Type': 'application/json'}, body: jsonEncode({'identifier': _limitedEmail, 'password': _adminPassword}));
      expect(limitedLogin.statusCode, 200);
      final limitedToken = (jsonDecode(limitedLogin.body) as Map<String, dynamic>)['accessToken'] as String?;
      expect(limitedToken, isNotNull);

      final limitedDenied = await http.get(Uri.parse('$baseUrl/api/v1/rbac/roles'), headers: {'Authorization': 'Bearer $limitedToken', 'x-tenant-id': _tenantId});
      expect(limitedDenied.statusCode, 403);
    });
  });
}
