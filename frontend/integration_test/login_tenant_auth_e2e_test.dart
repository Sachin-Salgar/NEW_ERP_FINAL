import 'dart:convert';

import 'package:flutter/foundation.dart';
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

Future<void> _pump(WidgetTester tester) async {
  await tester.pump(const Duration(milliseconds: 100));
  final exception = tester.takeException();
  if (exception != null) {
    fail('Flutter exception during E2E pump: $exception');
  }
}

Future<void> _waitFor(WidgetTester tester, Finder finder, {Duration timeout = const Duration(seconds: 15)}) async {
  final deadline = DateTime.now().add(timeout);
  while (DateTime.now().isBefore(deadline)) {
    await _pump(tester);
    if (finder.evaluate().isNotEmpty) return;
  }
  fail('Timed out waiting for finder: $finder');
}

Future<http.Response> _getWithTimeout(Uri uri) =>
    http.get(uri).timeout(const Duration(seconds: 10));

Future<void> _login(WidgetTester tester, String email) async {
  await _waitFor(tester, find.byKey(const ValueKey('login_identifier_field')));
  await tester.enterText(find.byKey(const ValueKey('login_identifier_field')), email);
  await tester.enterText(find.byKey(const ValueKey('login_password_field')), _adminPassword);
  await tester.tap(find.byKey(const ValueKey('login_submit_button')));
  await tester.pump();
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('E2E authenticated context flow', () {
    setUp(() async {
      await GetIt.instance.reset();
      await App.init();
    });

    testWidgets(
      'admin login goes directly to dashboard with tenant and default working context',
      (tester) async {
        final baseUrl = const String.fromEnvironment('API_BASE_URL', defaultValue: 'http://localhost:3000');
        await tester.pumpWidget(const App());
        await _pump(tester);
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
      'limited user reaches dashboard with its restricted working context',
      (tester) async {
        await tester.pumpWidget(const App());
        await _pump(tester);
        await _login(tester, _limitedEmail);
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
        expect(auth.availableLocations.length, equals(1));
      },
      timeout: const Timeout(Duration(seconds: 90)),
    );
  });
}
