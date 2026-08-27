import 'dart:async';
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

Future<void> _pump(WidgetTester tester) async => tester.pump(const Duration(milliseconds: 100));

Future<void> _waitFor(WidgetTester tester, Finder finder, {Duration timeout = const Duration(seconds: 15)}) async {
  final deadline = DateTime.now().add(timeout);
  while (DateTime.now().isBefore(deadline)) {
    await _pump(tester);
    if (finder.evaluate().isNotEmpty) return;
  }
  fail('Timed out waiting for finder: $finder');
}

Future<http.Response> _getWithTimeout(Uri uri) => http.get(uri).timeout(const Duration(seconds: 10));

Future<void> _login(WidgetTester tester, String email) async {
  await _waitFor(tester, find.byKey(const ValueKey('login_identifier_field')));
  await tester.enterText(find.byKey(const ValueKey('login_identifier_field')), email);
  await tester.enterText(find.byKey(const ValueKey('login_password_field')), _adminPassword);
  await tester.tap(find.byKey(const ValueKey('login_submit_button')));
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('E2E login and authorization flow', () {
    setUp(() async {
      await GetIt.instance.reset();
      await App.init();
    });

    tearDown(() async => GetIt.instance.reset());

    testWidgets(
      'admin login goes directly to dashboard with tenant and default working context',
      (tester) async {
        final baseUrl = const String.fromEnvironment('API_BASE_URL', defaultValue: 'http://localhost:3000');
        await tester.pumpWidget(const App());
        await _login(tester, _adminEmail);
        await _waitFor(tester, find.text('Dashboard'), timeout: const Duration(seconds: 30));

        expect(find.text('Select organization'), findsNothing);
        expect(find.text('Select location'), findsNothing);
        expect(find.text('Dashboard'), findsOneWidget);

        final auth = GetIt.instance.get<AuthService>();
        expect(auth.isAuthenticated, isTrue);
        expect(auth.currentTenantId, equals(_tenantId));
        expect(auth.currentOrganizationId, equals(_organizationId));
        expect(auth.requiresOrganizationSelection, isFalse);
        expect(auth.requiresLocationSelection, isFalse);
        expect(auth.availableLocations.length, equals(2));

        final bootstrapResponse = await _getWithTimeout(Uri.parse('$baseUrl/api/v1/bootstrap'));
        expect(bootstrapResponse.statusCode, equals(200));
        final bootstrap = jsonDecode(bootstrapResponse.body) as Map<String, dynamic>;
        final capabilities = bootstrap['capabilities'] as Map<String, dynamic>;
        expect(capabilities['tenantSelection'], isFalse);
        expect(capabilities['workingContextSelection'], isTrue);
      },
      timeout: const Timeout(Duration(seconds: 90)),
    );

    testWidgets(
      'limited user cannot access disabled module',
      (tester) async {
        final baseUrl = const String.fromEnvironment('API_BASE_URL', defaultValue: 'http://localhost:3000');
        await tester.pumpWidget(const App());
        await _login(tester, _limitedEmail);
        await _waitFor(tester, find.text('Dashboard'), timeout: const Duration(seconds: 30));

        final response = await _getWithTimeout(Uri.parse('$baseUrl/api/v1/auth/modules'));
        expect(response.statusCode, equals(200));
        final payload = jsonDecode(response.body) as Map<String, dynamic>;
        final modules = (payload['modules'] as List<dynamic>).cast<Map<String, dynamic>>();
        final module = modules.firstWhere((item) => item['code'] == _moduleCode);
        expect(module['enabled'], isFalse);
      },
      timeout: const Timeout(Duration(seconds: 90)),
    );
  });
}
