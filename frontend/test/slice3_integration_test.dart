import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'package:new_erp_final_frontend/core/auth/auth_service.dart';
import 'package:new_erp_final_frontend/core/network/api_client.dart';
import 'package:new_erp_final_frontend/routing/router.dart';

class _MemorySecureStorage implements SecureStorageLike {
  final Map<String, String> _values = {};

  @override
  Future<String?> read({required String key}) async => _values[key];

  @override
  Future<void> write({required String key, required String value}) async {
    _values[key] = value;
  }

  @override
  Future<void> delete({required String key}) async {
    _values.remove(key);
  }
}

void main() {
  setUp(() {
    GetIt.instance.reset();
  });

  tearDown(() {
    GetIt.instance.reset();
  });

  group('Slice 3 frontend auth behavior', () {
    test('ApiClient sends the real Bearer token and tenant header', () async {
      final storage = _MemorySecureStorage();
      final requests = <String, String>{};

      final client = MockClient((request) {
        requests['authorization'] = request.headers['Authorization'] ?? '';
        requests['tenant'] = request.headers['x-tenant-id'] ?? '';

        if (request.url.path == '/api/v1/bootstrap') {
          return Future.value(
            http.Response(
              jsonEncode({'deployment': {'tenantId': 'tenant-1'}}),
              200,
            ),
          );
        }
        if (request.url.path == '/api/v1/auth/login') {
          return Future.value(
            http.Response(
              jsonEncode({
                'accessToken': 'test-access-token',
                'refreshToken': 'refresh-token',
                'expiresAt': DateTime.now().add(const Duration(hours: 1)).toIso8601String(),
                'user': {'id': 'user-1', 'tenantId': 'tenant-1'},
                'session': {'tenantId': 'tenant-1'},
              }),
              200,
            ),
          );
        }
        if (request.url.path == '/api/v1/auth/organizations') {
          return Future.value(
            http.Response(
              jsonEncode({
                'organizations': [
                  {'id': 'org-1', 'name': 'Org 1', 'code': 'ORG1'},
                ],
                'activeOrganizationId': 'org-1',
                'requiresOrganizationSelection': false,
              }),
              200,
            ),
          );
        }
        if (request.url.path == '/api/v1/auth/me') {
          return Future.value(
            http.Response(
              jsonEncode({'user': {'id': 'user-1', 'tenantId': 'tenant-1'}}),
              200,
            ),
          );
        }
        return Future.value(http.Response('ok', 200));
      });

      late final AuthService auth;
      auth = AuthService(
        secureStorage: storage,
        apiClientFactory: (baseUrl) => ApiClient(baseUrl: baseUrl, httpClient: client, authOverride: auth),
      );

      final loginOk = await auth.login('http://example.com', 'user@example.com', 'Password123');
      expect(loginOk, isTrue);
      expect(auth.accessToken, 'test-access-token');
      expect(auth.currentTenantId, 'tenant-1');

      final response = await ApiClient(baseUrl: 'http://example.com', httpClient: client, authOverride: auth)
          .get('/api/v1/auth/me');

      expect(response.statusCode, 200);
      expect(requests['authorization'], 'Bearer test-access-token');
      expect(requests['tenant'], 'tenant-1');
    });

    test('ApiClient retries the request with the refreshed token after a 401', () async {
      final storage = _MemorySecureStorage();
      final authorizationHistory = <String>[];
      String? refreshHeader;

      final client = MockClient((request) {
        authorizationHistory.add(request.headers['Authorization'] ?? '');

        if (request.url.path == '/api/v1/bootstrap') {
          return Future.value(
            http.Response(
              jsonEncode({'deployment': {'tenantId': 'tenant-1'}}),
              200,
            ),
          );
        }
        if (request.url.path == '/api/v1/auth/login') {
          return Future.value(
            http.Response(
              jsonEncode({
                'accessToken': 'old-token',
                'refreshToken': 'refresh-token',
                'expiresAt': DateTime.now().add(const Duration(hours: 1)).toIso8601String(),
                'user': {'id': 'user-1', 'tenantId': 'tenant-1'},
                'session': {'tenantId': 'tenant-1'},
              }),
              200,
            ),
          );
        }
        if (request.url.path == '/api/v1/auth/organizations') {
          return Future.value(
            http.Response(
              jsonEncode({
                'organizations': [
                  {'id': 'org-1', 'name': 'Org 1', 'code': 'ORG1'},
                ],
                'activeOrganizationId': 'org-1',
                'requiresOrganizationSelection': false,
              }),
              200,
            ),
          );
        }
        if (request.url.path == '/api/v1/auth/refresh') {
          refreshHeader = request.headers['Authorization'];
          return Future.value(
            http.Response(
              jsonEncode({
                'accessToken': 'new-token',
                'expiresAt': DateTime.now().add(const Duration(hours: 1)).toIso8601String(),
              }),
              200,
            ),
          );
        }
        if (request.url.path == '/api/v1/protected') {
          final authHeader = request.headers['Authorization'] ?? '';
          if (authHeader == 'Bearer old-token') {
            return Future.value(http.Response('unauthorized', 401));
          }
          if (authHeader == 'Bearer new-token') {
            return Future.value(http.Response('ok', 200));
          }
        }
        return Future.value(http.Response('ok', 200));
      });

      late final AuthService auth;
      auth = AuthService(
        secureStorage: storage,
        apiClientFactory: (baseUrl) => ApiClient(baseUrl: baseUrl, httpClient: client, authOverride: auth),
      );

      final loginOk = await auth.login('http://example.com', 'user@example.com', 'Password123');
      expect(loginOk, isTrue);

      final response = await ApiClient(baseUrl: 'http://example.com', httpClient: client, authOverride: auth)
          .get('/api/v1/protected');

      expect(response.statusCode, 200);
      expect(refreshHeader, 'Bearer old-token');
      expect(auth.accessToken, 'new-token');
      expect(
        authorizationHistory.where((header) => header == 'Bearer new-token').isNotEmpty,
        isTrue,
      );
    });

    test('AuthService does not auto-select a single organization when the backend requires explicit selection', () async {
      final storage = _MemorySecureStorage();
      final client = MockClient((request) {
        if (request.url.path == '/api/v1/bootstrap') {
          return Future.value(
            http.Response(
              jsonEncode({'deployment': {'tenantId': 'tenant-1'}}),
              200,
            ),
          );
        }
        if (request.url.path == '/api/v1/auth/login') {
          return Future.value(
            http.Response(
              jsonEncode({
                'accessToken': 'test-access-token',
                'refreshToken': 'refresh-token',
                'expiresAt': DateTime.now().add(const Duration(hours: 1)).toIso8601String(),
                'user': {'id': 'user-1', 'tenantId': 'tenant-1'},
                'session': {'tenantId': 'tenant-1'},
              }),
              200,
            ),
          );
        }
        if (request.url.path == '/api/v1/auth/organizations') {
          return Future.value(
            http.Response(
              jsonEncode({
                'organizations': [
                  {'id': 'org-1', 'name': 'Org 1', 'code': 'ORG1'},
                ],
                'activeOrganizationId': '',
                'requiresOrganizationSelection': true,
              }),
              200,
            ),
          );
        }
        return Future.value(http.Response('ok', 200));
      });

      late final AuthService auth;
      auth = AuthService(
        secureStorage: storage,
        apiClientFactory: (baseUrl) => ApiClient(baseUrl: baseUrl, httpClient: client, authOverride: auth),
      );

      final loginOk = await auth.login('http://example.com', 'user@example.com', 'Password123');
      expect(loginOk, isTrue);
      expect(auth.requiresOrganizationSelection, isTrue);
      expect(auth.currentOrganizationId, isNull);
      expect(auth.selectedOrganizationId, isNull);
    });

    test('logout clears tokens, session state, and organization context', () async {
      final storage = _MemorySecureStorage();
      var selectionCommitted = false;

      final client = MockClient((request) {
        if (request.url.path == '/api/v1/bootstrap') {
          return Future.value(
            http.Response(
              jsonEncode({'deployment': {'tenantId': 'tenant-1'}}),
              200,
            ),
          );
        }
        if (request.url.path == '/api/v1/auth/login') {
          return Future.value(
            http.Response(
              jsonEncode({
                'accessToken': 'test-access-token',
                'refreshToken': 'refresh-token',
                'expiresAt': DateTime.now().add(const Duration(hours: 1)).toIso8601String(),
                'user': {'id': 'user-1', 'tenantId': 'tenant-1'},
                'session': {'tenantId': 'tenant-1'},
              }),
              200,
            ),
          );
        }
        if (request.url.path == '/api/v1/auth/organizations') {
          return Future.value(
            http.Response(
              jsonEncode({
                'organizations': [
                  {'id': 'org-1', 'name': 'Org 1', 'code': 'ORG1'},
                  {'id': 'org-2', 'name': 'Org 2', 'code': 'ORG2'},
                ],
                'activeOrganizationId': selectionCommitted ? 'org-2' : '',
                'requiresOrganizationSelection': selectionCommitted ? false : true,
              }),
              200,
            ),
          );
        }
        if (request.url.path == '/api/v1/auth/organizations/select') {
          selectionCommitted = true;
          return Future.value(
            http.Response(
              jsonEncode({
                'accessToken': 'selected-token',
                'refreshToken': 'selected-refresh',
                'expiresAt': DateTime.now().add(const Duration(hours: 1)).toIso8601String(),
                'user': {'id': 'user-1', 'tenantId': 'tenant-1'},
                'session': {'tenantId': 'tenant-1', 'organizationId': 'org-2'},
              }),
              200,
            ),
          );
        }
        if (request.url.path == '/api/v1/auth/logout') {
          return Future.value(http.Response('ok', 200));
        }
        return Future.value(http.Response('ok', 200));
      });

      late final AuthService auth;
      auth = AuthService(
        secureStorage: storage,
        apiClientFactory: (baseUrl) => ApiClient(baseUrl: baseUrl, httpClient: client, authOverride: auth),
      );

      final loginOk = await auth.login('http://example.com', 'user@example.com', 'Password123');
      expect(loginOk, isTrue);

      final selectionOk = await auth.selectOrganization('org-2');
      expect(selectionOk, isTrue);
      expect(auth.currentOrganizationId, 'org-2');

      await auth.logout();
      expect(auth.accessToken, isNull);
      expect(auth.currentTenantId, isNull);
      expect(auth.currentOrganizationId, isNull);
      expect(auth.selectedOrganizationId, isNull);
      expect(auth.availableOrganizations, isEmpty);
      expect(auth.requiresOrganizationSelection, isFalse);
    });

    test('AuthService validates a consistent organization branch location context before updating session state', () async {
      final storage = _MemorySecureStorage();
      final client = MockClient((request) {
        if (request.url.path == '/api/v1/auth/login') {
          return Future.value(
            http.Response(
              jsonEncode({
                'accessToken': 'test-access-token',
                'refreshToken': 'refresh-token',
                'expiresAt': DateTime.now().add(const Duration(hours: 1)).toIso8601String(),
                'user': {'id': 'user-1', 'tenantId': 'tenant-1'},
                'session': {'tenantId': 'tenant-1', 'organizationId': 'org-1', 'branchId': 'branch-1', 'locationId': 'loc-1'},
              }),
              200,
            ),
          );
        }
        if (request.url.path == '/api/v1/auth/organizations') {
          return Future.value(
            http.Response(
              jsonEncode({
                'organizations': [
                  {'id': 'org-1', 'name': 'Org 1', 'code': 'ORG1'},
                ],
                'activeOrganizationId': 'org-1',
                'requiresOrganizationSelection': false,
              }),
              200,
            ),
          );
        }
        if (request.url.path == '/api/v1/auth/context/select') {
          final body = jsonDecode(request.body);
          expect(body['organizationId'], 'org-1');
          expect(['branch-1', 'branch-2'].contains(body['branchId']), isTrue);
          expect(['loc-1', 'loc-2'].contains(body['locationId']), isTrue);
          return Future.value(
            http.Response(
              jsonEncode({
                'success': true,
                'user': {'id': 'user-1', 'tenantId': 'tenant-1', 'organizationId': body['organizationId'], 'defaultBranchId': body['branchId'], 'defaultLocationId': body['locationId']},
                'session': {'tenantId': 'tenant-1', 'organizationId': body['organizationId'], 'branchId': body['branchId'], 'locationId': body['locationId']},
                'accessToken': 'context-token',
                'refreshToken': 'context-refresh',
                'expiresAt': DateTime.now().add(const Duration(hours: 1)).toIso8601String(),
              }),
              200,
            ),
          );
        }
        if (request.url.path == '/api/v1/auth/modules') {
          return Future.value(http.Response(jsonEncode({'modules': []}), 200));
        }
        return Future.value(http.Response('ok', 200));
      });

      late final AuthService auth;
      auth = AuthService(
        secureStorage: storage,
        apiClientFactory: (baseUrl) => ApiClient(baseUrl: baseUrl, httpClient: client, authOverride: auth),
      );

      final loginOk = await auth.login('http://example.com', 'user@example.com', 'Password123');
      expect(loginOk, isTrue);

      auth.availableBranches = [
        {'id': 'branch-1', 'name': 'Branch 1', 'code': 'BR1'},
        {'id': 'branch-2', 'name': 'Branch 2', 'code': 'BR2'},
      ];
      auth.availableLocations = [
        {'id': 'loc-1', 'name': 'Location 1', 'code': 'L1'},
        {'id': 'loc-2', 'name': 'Location 2', 'code': 'L2'},
      ];
      auth.currentBranchId = 'branch-1';
      auth.selectedBranchId = 'branch-1';
      auth.currentLocationId = 'loc-1';
      auth.selectedLocationId = 'loc-1';

      final branchOk = await auth.selectBranch('branch-2');
      expect(branchOk, isTrue);
      expect(auth.currentBranchId, 'branch-2');

      final locationOk = await auth.selectLocation('loc-2');
      expect(locationOk, isTrue);
      expect(auth.currentLocationId, 'loc-2');
      expect(auth.currentOrganizationId, 'org-1');
    });

    testWidgets('AppRouter redirects authenticated users to the correct selection flow', (tester) async {
      final storage = _MemorySecureStorage();
      final client = MockClient((request) {
        if (request.url.path == '/api/v1/bootstrap') {
          return Future.value(
            http.Response(
              jsonEncode({'deployment': {'tenantId': 'tenant-1'}}),
              200,
            ),
          );
        }
        if (request.url.path == '/api/v1/auth/login') {
          return Future.value(
            http.Response(
              jsonEncode({
                'accessToken': 'test-access-token',
                'refreshToken': 'refresh-token',
                'expiresAt': DateTime.now().add(const Duration(hours: 1)).toIso8601String(),
                'user': {'id': 'user-1', 'tenantId': 'tenant-1'},
                'session': {'tenantId': 'tenant-1'},
              }),
              200,
            ),
          );
        }
        if (request.url.path == '/api/v1/auth/organizations') {
          return Future.value(
            http.Response(
              jsonEncode({
                'organizations': [
                  {'id': 'org-1', 'name': 'Org 1', 'code': 'ORG1'},
                ],
                'activeOrganizationId': '',
                'requiresOrganizationSelection': true,
              }),
              200,
            ),
          );
        }
        return Future.value(http.Response('ok', 200));
      });

      late final AuthService auth;
      auth = AuthService(
        secureStorage: storage,
        apiClientFactory: (baseUrl) => ApiClient(baseUrl: baseUrl, httpClient: client, authOverride: auth),
      );

      final loginOk = await auth.login('http://example.com', 'user@example.com', 'Password123');
      expect(loginOk, isTrue);
      expect(auth.requiresOrganizationSelection, isTrue);

      GetIt.instance.registerSingleton<AuthService>(auth);

      await tester.pumpWidget(
        MaterialApp(
          onGenerateRoute: AppRouter.generateRoute,
          initialRoute: '/dashboard',
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Select organization'), findsOneWidget);
      expect(find.text('Dashboard'), findsNothing);
    });
  });
}
