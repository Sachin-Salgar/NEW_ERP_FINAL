import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:http/testing.dart';
import 'package:http/http.dart' as http;

import 'package:new_erp_final_frontend/core/network/api_client.dart';
import 'package:new_erp_final_frontend/core/auth/auth_service.dart';
import 'package:new_erp_final_frontend/core/auth/authz_service.dart';
import 'package:new_erp_final_frontend/modules/role/list_screen.dart';

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

  testWidgets('roles render', (WidgetTester tester) async {
    final client = MockClient((request) async {
      if (request.url.path.contains('/rbac/roles')) {
        return http.Response(jsonEncode({
          'success': true,
          'roles': [
            {'id': 'r1', 'code': 'admin', 'name': 'Admin', 'description': 'Administrator', 'isSystem': true},
            {'id': 'r2', 'code': 'user', 'name': 'User', 'description': 'Regular user', 'isSystem': false},
          ]
        }), 200);
      }
      if (request.url.path.contains('effective-permissions')) {
        return http.Response(jsonEncode({
          'success': true,
          'userId': 'user-1',
          'permissions': ['role.read']
        }), 200);
      }
      return http.Response('not found', 404);
    });

    final api = ApiClient(baseUrl: 'http://example.com', httpClient: client);
    GetIt.instance.registerSingleton<ApiClient>(api);

    final authz = AuthZService();
    final auth = AuthService(secureStorage: _MemorySecureStorage(), apiClientFactory: (baseUrl) => api, authzService: authz);
    GetIt.instance.registerSingleton<AuthService>(auth);
    await authz.loadPermissions(api, 'user-1');

    await tester.pumpWidget(MaterialApp(home: RoleListScreen()));
    await tester.pump(); // triggers frame

    // allow async fetch to complete
    await tester.pump(const Duration(milliseconds: 200));
    await tester.pumpAndSettle();

    expect(find.text('Admin'), findsOneWidget);
    expect(find.text('User'), findsOneWidget);
    expect(find.byIcon(Icons.shield), findsOneWidget);
  });

  testWidgets('permission denied', (WidgetTester tester) async {
    final client = MockClient((request) async {
      return http.Response('not found', 404);
    });

    final api = ApiClient(baseUrl: 'http://example.com', httpClient: client);
    GetIt.instance.registerSingleton<ApiClient>(api);

    // Do not load role.read permission
    final authz = AuthZService();
    final auth = AuthService(secureStorage: _MemorySecureStorage(), apiClientFactory: (baseUrl) => api, authzService: authz);
    GetIt.instance.registerSingleton<AuthService>(auth);

    await tester.pumpWidget(MaterialApp(home: RoleListScreen()));
    await tester.pumpAndSettle();

    expect(find.text('You do not have permission to view roles.'), findsOneWidget);
  });

  testWidgets('empty response', (WidgetTester tester) async {
    final client = MockClient((request) async {
      if (request.url.path.contains('/rbac/roles')) {
        return http.Response(jsonEncode({'success': true, 'roles': []}), 200);
      }
      if (request.url.path.contains('effective-permissions')) {
        return http.Response(jsonEncode({
          'success': true,
          'userId': 'user-1',
          'permissions': ['role.read']
        }), 200);
      }
      return http.Response('not found', 404);
    });

    final api = ApiClient(baseUrl: 'http://example.com', httpClient: client);
    GetIt.instance.registerSingleton<ApiClient>(api);

    final authz = AuthZService();
    final auth = AuthService(secureStorage: _MemorySecureStorage(), apiClientFactory: (baseUrl) => api, authzService: authz);
    GetIt.instance.registerSingleton<AuthService>(auth);
    await authz.loadPermissions(api, 'user-1');

    await tester.pumpWidget(MaterialApp(home: RoleListScreen()));
    await tester.pump();
    await tester.pumpAndSettle();

    expect(find.text('No roles found.'), findsOneWidget);
  });

  testWidgets('api failure shows error', (WidgetTester tester) async {
    final client = MockClient((request) async {
      if (request.url.path.contains('/rbac/roles')) {
        return http.Response('server error', 500);
      }
      if (request.url.path.contains('effective-permissions')) {
        return http.Response(jsonEncode({
          'success': true,
          'userId': 'user-1',
          'permissions': ['role.read']
        }), 200);
      }
      return http.Response('not found', 404);
    });

    final api = ApiClient(baseUrl: 'http://example.com', httpClient: client);
    GetIt.instance.registerSingleton<ApiClient>(api);

    final authz = AuthZService();
    final auth = AuthService(secureStorage: _MemorySecureStorage(), apiClientFactory: (baseUrl) => api, authzService: authz);
    GetIt.instance.registerSingleton<AuthService>(auth);
    await authz.loadPermissions(api, 'user-1');

    await tester.pumpWidget(MaterialApp(home: RoleListScreen()));
    await tester.pump();
    await tester.pumpAndSettle();

    expect(find.textContaining('Error:'), findsOneWidget);
  });
}
