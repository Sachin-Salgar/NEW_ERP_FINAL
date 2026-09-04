import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/testing.dart';
import 'package:http/http.dart' as http;

import 'package:new_erp_final_frontend/core/auth/auth_service.dart';
import 'package:new_erp_final_frontend/core/auth/authz_service.dart';
import 'package:new_erp_final_frontend/core/network/api_client.dart';
import 'package:new_erp_final_frontend/modules/customer/customer_service.dart';

void main() {
  test(
    'uses active organization and server pagination for customer list',
    () async {
      Uri? requested;
      final client = MockClient((request) async {
        requested = request.url;
        return http.Response(
          jsonEncode({
            'customers': [
              {'id': 'customer-1', 'name': 'Acme'},
            ],
            'metadata': {'total': 1},
          }),
          200,
        );
      });
      final auth = AuthService(authzService: AuthZService());
      auth.currentOrganizationId = 'org-1';
      final service = CustomerService(
        apiClient: ApiClient(baseUrl: 'http://example.com', httpClient: client),
        auth: auth,
      );

      await service.fetchCustomers(search: 'Acme', page: 2);

      expect(requested?.path, '/api/v1/customers');
      expect(requested?.queryParameters['page'], '2');
      expect(requested?.queryParameters['page_size'], '20');
      expect(requested?.queryParameters['search'], 'Acme');
      expect(service.customers.single['name'], 'Acme');
      expect(service.totalPages, 1);
    },
  );

  test('refreshes the customer list after a successful create', () async {
    final methods = <String>[];
    final client = MockClient((request) async {
      methods.add(request.method);
      if (request.method == 'POST') {
        return http.Response(
          jsonEncode({
            'customer': {'id': 'new'},
          }),
          201,
        );
      }
      return http.Response(
        jsonEncode({
          'customers': [
            {'id': 'new', 'name': 'Acme'},
          ],
          'metadata': {'total': 1},
        }),
        200,
      );
    });
    final auth = AuthService(authzService: AuthZService());
    auth.currentOrganizationId = 'org-1';
    final service = CustomerService(
      apiClient: ApiClient(baseUrl: 'http://example.com', httpClient: client),
      auth: auth,
    );

    expect(await service.createCustomer('Acme'), isNull);

    expect(methods, ['POST', 'GET']);
    expect(service.customers.single['name'], 'Acme');
  });

  test(
    'extracts nested backend error messages and preserves supported forms',
    () async {
      final responses = <http.Response>[
        http.Response(
          jsonEncode({
            'error': {'message': 'Name is already used.'},
          }),
          422,
        ),
        http.Response(jsonEncode({'message': 'Legacy message'}), 422),
        http.Response(jsonEncode({'error': 'String error'}), 422),
        http.Response('{malformed', 422),
      ];
      final client = MockClient((_) async => responses.removeAt(0));
      final auth = AuthService(authzService: AuthZService());
      auth.currentOrganizationId = 'org-1';
      final service = CustomerService(
        apiClient: ApiClient(baseUrl: 'http://example.com', httpClient: client),
        auth: auth,
      );

      expect(await service.createCustomer('Acme'), 'Name is already used.');
      expect(await service.createCustomer('Acme'), 'Legacy message');
      expect(await service.createCustomer('Acme'), 'String error');
      expect(
        await service.createCustomer('Acme'),
        'Request failed (HTTP 422).',
      );
    },
  );

  test('sends only the supported customer fields for mutations', () async {
    final requests = <http.Request>[];
    final client = MockClient((request) async {
      requests.add(request);
      if (request.method == 'POST') {
        return http.Response(
          jsonEncode({
            'customer': {'id': 'new'},
          }),
          201,
        );
      }
      if (request.method == 'PATCH') {
        return http.Response(
          jsonEncode({
            'customer': {'id': 'c-1', 'name': 'Acme Updated'},
          }),
          200,
        );
      }
      if (request.method == 'GET') {
        return http.Response(
          jsonEncode({
            'customers': [],
            'metadata': {'total': 0},
          }),
          200,
        );
      }
      return http.Response(jsonEncode({'deleted': true}), 200);
    });
    final auth = AuthService(authzService: AuthZService());
    auth.currentOrganizationId = 'org-1';
    final service = CustomerService(
      apiClient: ApiClient(baseUrl: 'http://example.com', httpClient: client),
      auth: auth,
    );

    expect(await service.createCustomer('Acme'), isNull);
    expect(await service.updateCustomer('c-1', 'Acme Updated'), {
      'id': 'c-1',
      'name': 'Acme Updated',
    });
    expect(await service.deleteCustomer('c-1'), isNull);

    expect(jsonDecode(requests[0].body), {
      'organizationId': 'org-1',
      'name': 'Acme',
    });
    expect(jsonDecode(requests[2].body), {'name': 'Acme Updated'});
    expect(requests[3].method, 'DELETE');
  });
}
