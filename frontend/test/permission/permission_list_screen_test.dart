import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:http/testing.dart';
import 'package:http/http.dart' as http;

import 'package:new_erp_final_frontend/core/network/api_client.dart';
import 'package:new_erp_final_frontend/core/auth/auth_service.dart';
import 'package:new_erp_final_frontend/core/auth/authz_service.dart';
import 'package:new_erp_final_frontend/modules/permission/permission_list_screen.dart';

import '../test_utils.dart';

void main() {
  setUp(() {
    GetIt.instance.reset();
  });

  testWidgets('Permission list renders and navigates to detail', (WidgetTester tester) async {
    final mockClient = MockClient((request) async {
      if (request.url.path.contains('/api/v1/auth/login')) {
        return http.Response(
          jsonEncode({
            'accessToken': 'token',
            'refreshToken': 'refresh',
            'expiresAt': DateTime.now().add(const Duration(hours: 1)).toIso8601String(),
            'user': {'id': 'user-id', 'tenantId': 'tenant-1'},
            'session': {'tenantId': 'tenant-1'},
          }),
          200,
        );
      }
      if (request.url.path.contains('/api/v1/auth/modules')) {
        return http.Response(jsonEncode({'modules': [{'code': 'security'}]}), 200);
      }
      if (request.url.path.contains('/api/v1/rbac/permissions')) {
        return http.Response(jsonEncode({'permissions': ['perm.read', 'perm.write']}), 200);
      }
      if (request.url.path.contains('/api/v1/rbac/users/user-id/effective-permissions')) {
        return http.Response(jsonEncode({'permissions': ['permission.read']}), 200);
      }
      return http.Response('{}', 200);
    });

    final apiClient = ApiClient(baseUrl: 'http://example.com', httpClient: mockClient);
    registerTestServices(apiClient: apiClient);

    final auth = GetIt.instance.get<AuthService>();
    await auth.login('http://example.com', 'user@example.com', 'password');

    final authz = GetIt.instance.get<AuthZService>();
    await authz.loadPermissions(apiClient, 'user-id');

    await tester.pumpWidget(TestApp(child: PermissionListScreen()));
    await tester.pumpAndSettle();

    expect(find.text('Read Perm'), findsOneWidget);
    expect(find.text('Write Perm'), findsOneWidget);

    await tester.tap(find.text('Read Perm'));
    await tester.pumpAndSettle();

    expect(find.text('Read Perm'), findsWidgets);
  });

  testWidgets('Permission list shows permission denied', (WidgetTester tester) async {
    final mockClient = MockClient((request) async {
      if (request.url.path.contains('/api/v1/auth/login')) {
        return http.Response(
          jsonEncode({
            'accessToken': 'token',
            'refreshToken': 'refresh',
            'expiresAt': DateTime.now().add(const Duration(hours: 1)).toIso8601String(),
            'user': {'id': 'user-id', 'tenantId': 'tenant-1'},
            'session': {'tenantId': 'tenant-1'},
          }),
          200,
        );
      }
      if (request.url.path.contains('/api/v1/auth/modules')) {
        return http.Response(jsonEncode({'modules': [{'code': 'security'}]}), 200);
      }
      if (request.url.path.contains('/api/v1/rbac/permissions')) {
        return http.Response(jsonEncode({'permissions': ['perm.read']}), 200);
      }
      if (request.url.path.contains('/api/v1/rbac/users/user-id/effective-permissions')) {
        return http.Response(jsonEncode({'permissions': []}), 200);
      }
      return http.Response('{}', 200);
    });

    final apiClient = ApiClient(baseUrl: 'http://example.com', httpClient: mockClient);
    registerTestServices(apiClient: apiClient);

    final auth = GetIt.instance.get<AuthService>();
    await auth.login('http://example.com', 'user@example.com', 'password');

    final authz = GetIt.instance.get<AuthZService>();
    await authz.loadPermissions(apiClient, 'user-id');

    await tester.pumpWidget(TestApp(child: PermissionListScreen()));
    await tester.pumpAndSettle();

    expect(find.text('You do not have permission to view permissions.'), findsOneWidget);
  });

  testWidgets('Permission list shows error on server failure', (WidgetTester tester) async {
    final mockClient = MockClient((request) async {
      if (request.url.path.contains('/api/v1/auth/login')) {
        return http.Response(
          jsonEncode({
            'accessToken': 'token',
            'refreshToken': 'refresh',
            'expiresAt': DateTime.now().add(const Duration(hours: 1)).toIso8601String(),
            'user': {'id': 'user-id', 'tenantId': 'tenant-1'},
            'session': {'tenantId': 'tenant-1'},
          }),
          200,
        );
      }
      if (request.url.path.contains('/api/v1/auth/modules')) {
        return http.Response(jsonEncode({'modules': [{'code': 'security'}]}), 200);
      }
      if (request.url.path.contains('/api/v1/rbac/permissions')) {
        return http.Response('Internal Server Error', 500);
      }
      if (request.url.path.contains('/api/v1/rbac/users/user-id/effective-permissions')) {
        return http.Response(jsonEncode({'permissions': ['permission.read']}), 200);
      }
      return http.Response('{}', 200);
    });

    final apiClient = ApiClient(baseUrl: 'http://example.com', httpClient: mockClient);
    registerTestServices(apiClient: apiClient);

    final auth = GetIt.instance.get<AuthService>();
    await auth.login('http://example.com', 'user@example.com', 'password');

    final authz = GetIt.instance.get<AuthZService>();
    await authz.loadPermissions(apiClient, 'user-id');

    await tester.pumpWidget(TestApp(child: PermissionListScreen()));
    await tester.pumpAndSettle();

    expect(find.textContaining('Failed to load permissions'), findsOneWidget);
  });
}
