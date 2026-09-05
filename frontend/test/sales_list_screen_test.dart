import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'package:new_erp_final_frontend/core/auth/auth_service.dart';
import 'package:new_erp_final_frontend/core/auth/authz_service.dart';
import 'package:new_erp_final_frontend/core/network/api_client.dart';
import 'package:new_erp_final_frontend/modules/sales/list_screen.dart';
import 'package:new_erp_final_frontend/modules/sales/sales_service.dart';

class _MemorySecureStorage implements SecureStorageLike {
  final Map<String, String> values = {};

  @override
  Future<String?> read({required String key}) async => values[key];

  @override
  Future<void> write({required String key, required String value}) async =>
      values[key] = value;

  @override
  Future<void> delete({required String key}) async => values.remove(key);
}

void main() {
  setUp(() => GetIt.instance.reset());
  tearDown(() => GetIt.instance.reset());

  Future<AuthService> registerSales({
    required MockClient client,
    List<String> permissions = const [
      'sales.quotation.read',
      'sales.quotation.create',
    ],
  }) async {
    final api = ApiClient(baseUrl: 'http://example.com', httpClient: client);
    final authz = AuthZService();
    final auth = AuthService(
      secureStorage: _MemorySecureStorage(),
      apiClientFactory: (_) => api,
      authzService: authz,
    );
    auth.currentOrganizationId = 'org-1';
    await authz.loadPermissions(
      ApiClient(
        baseUrl: 'http://example.com',
        httpClient: MockClient(
          (_) async => http.Response(
            jsonEncode({'success': true, 'permissions': permissions}),
            200,
          ),
        ),
      ),
      'user-1',
    );
    GetIt.instance
      ..registerSingleton<AuthService>(auth)
      ..registerSingleton<SalesService>(
        SalesService(apiClient: api, auth: auth),
      );
    return auth;
  }

  testWidgets('renders quotation list, status, search, and pagination', (
    tester,
  ) async {
    Uri? requested;
    final client = MockClient((request) async {
      requested = request.url;
      return http.Response(
        jsonEncode({
          'quotations': [
            {
              'id': 'q-1',
              'quotationNumber': 'Q-000001',
              'status': 'DRAFT',
              'quotationDate': '2026-09-01',
            },
          ],
          'metadata': {'total': 21},
        }),
        200,
      );
    });
    await registerSales(client: client);
    await tester.pumpWidget(
      const MaterialApp(home: SalesQuotationListScreen()),
    );
    await tester.pumpAndSettle();

    expect(find.text('Q-000001'), findsOneWidget);
    expect(find.textContaining('DRAFT'), findsOneWidget);
    expect(find.text('1 / 2'), findsOneWidget);
    await tester.enterText(find.byType(TextField), 'Q-000001');
    await tester.testTextInput.receiveAction(TextInputAction.search);
    await tester.pumpAndSettle();
    expect(requested?.queryParameters['search'], 'Q-000001');
  });

  testWidgets('renders empty and error states', (tester) async {
    final responses = <http.Response>[
      http.Response(
        jsonEncode({
          'quotations': [],
          'metadata': {'total': 0},
        }),
        200,
      ),
      http.Response('server error', 500),
    ];
    final client = MockClient((_) async => responses.removeAt(0));
    await registerSales(client: client);
    await tester.pumpWidget(
      const MaterialApp(home: SalesQuotationListScreen()),
    );
    await tester.pumpAndSettle();
    expect(find.text('No quotations found.'), findsOneWidget);

    await tester.tap(find.byIcon(Icons.search));
    await tester.pumpAndSettle();
    expect(find.textContaining('Request failed'), findsOneWidget);
  });

  testWidgets('renders permission denial and hides create action', (
    tester,
  ) async {
    final client = MockClient((_) async => http.Response('{}', 200));
    await registerSales(client: client, permissions: const []);
    await tester.pumpWidget(
      const MaterialApp(home: SalesQuotationListScreen()),
    );
    await tester.pumpAndSettle();

    expect(
      find.text('You do not have permission to view quotations.'),
      findsOneWidget,
    );
    expect(find.byTooltip('Create quotation'), findsNothing);
  });
}
