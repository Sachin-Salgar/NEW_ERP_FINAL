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

Future<void> _pump(WidgetTester tester) async {
  await tester.pump(const Duration(milliseconds: 100));
}

Future<void> _waitFor(WidgetTester tester, Finder finder, {Duration timeout = const Duration(seconds: 15)}) async {
  final deadline = DateTime.now().add(timeout);
  while (DateTime.now().isBefore(deadline)) {
    await _pump(tester);
    if (finder.evaluate().isNotEmpty) return;
  }
  fail('Timed out waiting for finder: $finder');
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
      final frameworkErrors = <FlutterErrorDetails>[];
      final previousOnError = FlutterError.onError;
      FlutterError.onError = (details) {
        frameworkErrors.add(details);
        previousOnError?.call(details);
      };
      addTearDown(() => FlutterError.onError = previousOnError);

      await tester.pumpWidget(const App());
      await _waitFor(tester, find.byKey(const ValueKey('login_identifier_field')));

      await tester.enterText(find.byKey(const ValueKey('login_identifier_field')), _adminEmail);
      await tester.enterText(find.byKey(const ValueKey('login_password_field')), _adminPassword);
      await tester.tap(find.byKey(const ValueKey('login_submit_button')));

      // Do not use pumpAndSettle here: the dashboard performs asynchronous API work and
      // application state changes. Wait for the actual navigation contract instead.
      await _waitFor(tester, find.text('Dashboard'), timeout: const Duration(seconds: 20));

      if (frameworkErrors.isNotEmpty) {
        final first = frameworkErrors.first;
        fail('Flutter framework error during login/dashboard transition: ${first.exception}\n${first.stack}');
      }

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

      final bootstrapResponse = await http.get(Uri.parse('$baseUrl/api/v1/bootstrap'));
      expect(bootstrapResponse.statusCode, equals(200));
      final bootstrap = jsonDecode(bootstrapResponse.body) as Map<String, dynamic>;
      expect((bootstrap['capabilities'] as Map<String, dynamic>)['tenantSelection'], isFalse);
      expect((bootstrap['capabilities'] as Map<String, dynamic>)['workingContextSelection'], isTrue);
    });

    testWidgets('limited user cannot access disabled module', (tester) async {
      final baseUrl = const String.fromEnvironment('API_BASE_URL', defaultValue: 'http://localhost:3000');
      await tester.pumpWidget(const App());
      await _waitFor(tester, find.byKey(const ValueKey('login_identifier_field')));
      await tester.enterText(find.byKey(const ValueKey('login_identifier_field')), _limitedEmail);
      await tester.enterText(find.byKey(const ValueKey('login_password_field')), _adminPassword);
      await tester.tap(find.byKey(const ValueKey('login_submit_button')));
      await _waitFor(tester, find.text('Dashboard'), timeout: const Duration(seconds: 20));

      final response = await http.get(Uri.parse('$baseUrl/api/v1/auth/modules'));
      expect(response.statusCode, equals(200));
      final payload = jsonDecode(response.body) as Map<String, dynamic>;
      final modules = (payload['modules'] as List<dynamic>).cast<Map<String, dynamic>>();
      final module = modules.firstWhere((item) => item['code'] == _moduleCode);
      expect(module['enabled'], isFalse);
    });
  });
}
