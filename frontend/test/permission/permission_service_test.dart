import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'package:new_erp_final_frontend/core/auth/auth_service.dart';
import 'package:new_erp_final_frontend/core/network/api_client.dart';
import 'package:new_erp_final_frontend/modules/permission/permission_service.dart';

class _MemorySecureStorage implements SecureStorageLike {
  final Map<String, String> values = {};

  @override
  Future<String?> read({required String key}) async => values[key];

  @override
  Future<void> write({required String key, required String value}) async {
    values[key] = value;
  }

  @override
  Future<void> delete({required String key}) async {
    values.remove(key);
  }
}

void main() {
  late AuthService auth;

  setUp(() {
    GetIt.instance.reset();
    auth = AuthService(secureStorage: _MemorySecureStorage());
    GetIt.instance.registerSingleton<AuthService>(auth);
  });

  tearDown(() {
    GetIt.instance.reset();
  });

  test('loads every permission page and removes duplicate keys', () async {
    final requestedPages = <int>[];
    final client = MockClient((request) async {
      final page = int.parse(request.url.queryParameters['page']!);
      requestedPages.add(page);
      final permissions = page == 1
          ? [
              {'permissionKey': 'core.read', 'moduleCode': 'core', 'resource': 'core', 'action': 'read'},
              {'permissionKey': 'security.read', 'moduleCode': 'security', 'resource': 'role', 'action': 'read'},
            ]
          : [
              {'permissionKey': 'purchase.receipt.complete', 'moduleCode': 'purchase', 'resource': 'receipt', 'action': 'complete'},
              {'permissionKey': 'security.read', 'moduleCode': 'security', 'resource': 'role', 'action': 'read'},
            ];
      return http.Response(
        jsonEncode({
          'success': true,
          'permissions': permissions,
          'metadata': {'page': page, 'page_size': 100, 'total': 3, 'total_pages': 2},
        }),
        200,
      );
    });

    final service = PermissionService(
      apiClient: ApiClient(baseUrl: 'http://example.com', httpClient: client),
    );
    await service.fetchPermissions();

    expect(requestedPages, [1, 2]);
    expect(service.error, isNull);
    expect(service.permissions, [
      'core.read',
      'security.read',
      'purchase.receipt.complete',
    ]);
  });

  test('stops after a single page when metadata is absent', () async {
    var requests = 0;
    final client = MockClient((request) async {
      requests++;
      return http.Response(
        jsonEncode({
          'success': true,
          'permissions': [
            {'permissionKey': 'core.read', 'moduleCode': 'core', 'resource': 'core', 'action': 'read'},
          ],
        }),
        200,
      );
    });

    final service = PermissionService(
      apiClient: ApiClient(baseUrl: 'http://example.com', httpClient: client),
    );
    await service.fetchPermissions();

    expect(requests, 1);
    expect(service.permissions, ['core.read']);
  });

  test('surfaces a later page failure without exposing a partial catalog', () async {
    final client = MockClient((request) async {
      final page = int.parse(request.url.queryParameters['page']!);
      if (page == 1) {
        return http.Response(
          jsonEncode({
            'permissions': [
              {'permissionKey': 'core.read', 'moduleCode': 'core', 'resource': 'core', 'action': 'read'},
            ],
            'metadata': {'page': 1, 'page_size': 100, 'total': 2, 'total_pages': 2},
          }),
          200,
        );
      }
      return http.Response('server failure', 500);
    });

    final service = PermissionService(
      apiClient: ApiClient(baseUrl: 'http://example.com', httpClient: client),
    );
    await service.fetchPermissions();

    expect(service.error, 'Error: Failed to load permissions: 500');
    expect(service.permissions, isEmpty);
    expect(service.permissionDetails, isEmpty);
  });
}
