import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/testing.dart';
import 'package:http/http.dart' as http;

import 'package:new_erp_final_frontend/core/auth/auth_service.dart';
import 'package:new_erp_final_frontend/core/auth/authz_service.dart';
import 'package:new_erp_final_frontend/core/network/api_client.dart';
import 'package:new_erp_final_frontend/modules/sales/sales_service.dart';

void main() {
  test('lists quotations with server pagination and search', () async {
    Uri? requested;
    final client = MockClient((request) async {
      requested = request.url;
      return http.Response(
        jsonEncode({
          'quotations': [
            {'id': 'q-1', 'quotationNumber': 'Q-000001', 'status': 'DRAFT'},
          ],
          'metadata': {'total': 1},
        }),
        200,
      );
    });
    final auth = AuthService(authzService: AuthZService())
      ..currentOrganizationId = 'org-1';
    final service = SalesService(
      apiClient: ApiClient(baseUrl: 'http://example.com', httpClient: client),
      auth: auth,
    );

    await service.fetchQuotations(search: 'Q-000001', page: 2);

    expect(requested?.path, '/api/v1/sales/quotations');
    expect(requested?.queryParameters['page'], '2');
    expect(requested?.queryParameters['search'], 'Q-000001');
    expect(service.quotations.single['status'], 'DRAFT');
  });

  test('sends quotation lifecycle actions to dedicated endpoints', () async {
    final paths = <String>[];
    final client = MockClient((request) async {
      paths.add(request.url.path);
      return http.Response(
        jsonEncode({
          'quotation': {'id': 'q-1'},
        }),
        200,
      );
    });
    final service = SalesService(
      apiClient: ApiClient(baseUrl: 'http://example.com', httpClient: client),
      auth: AuthService(authzService: AuthZService()),
    );

    expect(await service.transition('q-1', 'send', 1), isNull);
    expect(paths, ['/api/v1/sales/quotations/q-1/send']);
  });
}
