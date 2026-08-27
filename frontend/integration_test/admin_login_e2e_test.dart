import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:integration_test/integration_test.dart';

import 'package:new_erp_final_frontend/app/app.dart';
import 'package:new_erp_final_frontend/core/auth/auth_service.dart';

const _tenantId = '11111111-1111-4111-8111-111111111111';
const _organizationId = '22222222-2222-4222-8222-222222222222';
const _adminEmail = 'e2e@example.com';
const _adminPassword = 'Password123!';

Future<void> _waitFor(WidgetTester tester, Finder finder, {Duration timeout = const Duration(seconds: 30)}) async {
  final deadline = DateTime.now().add(timeout);
  while (DateTime.now().isBefore(deadline)) {
    await tester.pump(const Duration(milliseconds: 100));
    if (finder.evaluate().isNotEmpty) return;
  }
  fail('Timed out waiting for finder: $finder');
}

Future<void> _login(WidgetTester tester) async {
  await _waitFor(tester, find.byKey(const ValueKey('login_identifier_field')));
  await tester.enterText(find.byKey(const ValueKey('login_identifier_field')), _adminEmail);
  await tester.enterText(find.byKey(const ValueKey('login_password_field')), _adminPassword);
  await tester.tap(find.byKey(const ValueKey('login_submit_button')));
  await tester.pump();
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('admin login goes directly to dashboard with authenticated working context', (tester) async {
    await GetIt.instance.reset();
    await App.init();
    await tester.pumpWidget(const App());
    await _login(tester);
    await _waitFor(tester, find.text('Dashboard'));

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
  }, timeout: const Timeout(Duration(seconds: 90)));
}
