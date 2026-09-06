import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'package:new_erp_final_frontend/core/auth/auth_service.dart';
import 'package:new_erp_final_frontend/core/auth/authz_service.dart';
import 'package:new_erp_final_frontend/core/network/api_client.dart';
import 'package:new_erp_final_frontend/modules/purchase/purchase_service.dart';

void main() {
  test('keeps pagination independent for each purchase resource', () async {
    final requests = <String>[];
    final client = MockClient((request) async {
      requests.add(request.url.toString());
      final key = request.url.path.endsWith('suppliers')
          ? 'suppliers'
          : request.url.path.endsWith('receipts')
          ? 'receipts'
          : request.url.path.endsWith('requisitions')
          ? 'requisitions'
          : 'purchaseOrders';
      return http.Response(
        jsonEncode({
          key: <Map<String, dynamic>>[],
          'metadata': {'total': 42},
        }),
        200,
      );
    });
    final auth = AuthService(authzService: AuthZService())
      ..currentOrganizationId = 'org-1';
    final service = PurchaseService(
      apiClient: ApiClient(baseUrl: 'http://example.com', httpClient: client),
      auth: auth,
    );

    await service.load(type: 'suppliers', page: 3);
    await service.load(type: 'receipts', page: 2);

    expect(service.pages['suppliers'], 3);
    expect(service.pages['receipts'], 2);
    expect(requests[0], contains('/api/v1/purchase/suppliers?page=3'));
    expect(requests[1], contains('/api/v1/purchase/receipts?page=2'));
  });
}
