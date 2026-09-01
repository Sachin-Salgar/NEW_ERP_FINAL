import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'package:new_erp_final_frontend/core/auth/auth_service.dart';
import 'package:new_erp_final_frontend/core/auth/authz_service.dart';
import 'package:new_erp_final_frontend/core/network/api_client.dart';
import 'package:new_erp_final_frontend/modules/role/role_service.dart';
import 'package:new_erp_final_frontend/modules/user/user_role_assignment_screen.dart';
import 'package:new_erp_final_frontend/modules/user/user_service.dart';

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

  testWidgets('permission gate hides role assignment UI without user.manage', (
    WidgetTester tester,
  ) async {
    final effectivePermissions = <String>[];
    final client = MockClient((request) async {
      if (request.url.path.contains('/api/v1/users/user-1')) {
        return http.Response(
          jsonEncode({
            'user': {'id': 'user-1', 'username': 'demo'},
          }),
          200,
        );
      }
      if (request.url.path.contains('/api/v1/rbac/roles') &&
          request.method == 'GET') {
        return http.Response(
          jsonEncode({
            'success': true,
            'roles': [
              {'id': 'role-1', 'name': 'Reader', 'description': 'Read only'},
              {'id': 'role-2', 'name': 'Editor', 'description': 'Can edit'},
            ],
          }),
          200,
        );
      }
      if (request.url.path.contains('/api/v1/rbac/roles/role-1/permissions') &&
          request.method == 'GET') {
        return http.Response(
          jsonEncode({
            'success': true,
            'permissions': [
              {'permissionKey': 'user.read'},
            ],
          }),
          200,
        );
      }
      if (request.url.path.contains('/api/v1/rbac/roles/role-2/permissions') &&
          request.method == 'GET') {
        return http.Response(
          jsonEncode({
            'success': true,
            'permissions': [
              {'permissionKey': 'role.write'},
            ],
          }),
          200,
        );
      }
      if (request.url.path.contains(
        '/api/v1/rbac/users/user-1/effective-permissions',
      )) {
        return http.Response(
          jsonEncode({'success': true, 'permissions': effectivePermissions}),
          200,
        );
      }
      return http.Response('not found', 404);
    });

    final api = ApiClient(baseUrl: 'http://example.com', httpClient: client);
    GetIt.instance.registerSingleton<ApiClient>(api);

    final authz = AuthZService();
    final auth = AuthService(
      secureStorage: _MemorySecureStorage(),
      apiClientFactory: (_) => api,
      authzService: authz,
    );
    GetIt.instance.registerSingleton<AuthService>(auth);
    await authz.loadPermissions(api, 'user-1');

    final userService = UserService(apiClient: api);
    GetIt.instance.registerSingleton<UserService>(userService);
    final roleService = RoleService(apiClient: api);
    GetIt.instance.registerSingleton<RoleService>(roleService);

    await tester.pumpWidget(
      MaterialApp(home: UserRoleAssignmentScreen(userId: 'user-1')),
    );
    await tester.pumpAndSettle();

    expect(
      find.text('You do not have permission to manage user roles.'),
      findsOneWidget,
    );
  });

  testWidgets('assigning a role updates the current roles list', (
    WidgetTester tester,
  ) async {
    final effectivePermissions = <String>['user.manage', 'user.read'];
    final client = MockClient((request) async {
      final path = request.url.path;

      if (path.contains('/api/v1/users/user-1')) {
        return http.Response(
          jsonEncode({
            'user': {'id': 'user-1', 'username': 'demo'},
          }),
          200,
        );
      }
      if (path.endsWith('/api/v1/rbac/roles') && request.method == 'GET') {
        return http.Response(
          jsonEncode({
            'success': true,
            'roles': [
              {'id': 'role-1', 'name': 'Reader', 'description': 'Read only'},
              {'id': 'role-2', 'name': 'Editor', 'description': 'Can edit'},
            ],
          }),
          200,
        );
      }
      if (path.contains('/api/v1/rbac/roles/role-1/permissions') &&
          request.method == 'GET') {
        return http.Response(
          jsonEncode({
            'success': true,
            'permissions': [
              {'permissionKey': 'user.read'},
            ],
          }),
          200,
        );
      }
      if (path.contains('/api/v1/rbac/roles/role-2/permissions') &&
          request.method == 'GET') {
        return http.Response(
          jsonEncode({
            'success': true,
            'permissions': [
              {'permissionKey': 'role.write'},
            ],
          }),
          200,
        );
      }
      if (path.contains('/api/v1/rbac/users/user-1/effective-permissions')) {
        return http.Response(
          jsonEncode({'success': true, 'permissions': effectivePermissions}),
          200,
        );
      }
      if (path.contains('/api/v1/rbac/users/user-1/roles') &&
          request.method == 'POST') {
        effectivePermissions.add('role.write');
        return http.Response(
          jsonEncode({'success': true, 'assigned': true}),
          200,
        );
      }
      return http.Response('not found', 404);
    });

    final api = ApiClient(baseUrl: 'http://example.com', httpClient: client);
    GetIt.instance.registerSingleton<ApiClient>(api);

    final authz = AuthZService();
    final auth = AuthService(
      secureStorage: _MemorySecureStorage(),
      apiClientFactory: (_) => api,
      authzService: authz,
    );
    GetIt.instance.registerSingleton<AuthService>(auth);
    await authz.loadPermissions(api, 'user-1');

    final userService = UserService(apiClient: api);
    GetIt.instance.registerSingleton<UserService>(userService);
    final roleService = RoleService(apiClient: api);
    GetIt.instance.registerSingleton<RoleService>(roleService);

    await tester.pumpWidget(
      MaterialApp(home: UserRoleAssignmentScreen(userId: 'user-1')),
    );
    await tester.pumpAndSettle();

    expect(find.text('Reader'), findsWidgets);
    expect(find.text('Editor'), findsWidgets);

    await tester.tap(find.widgetWithText(ElevatedButton, 'Assign').first);
    await tester.pumpAndSettle();

    expect(find.text('Role assigned'), findsOneWidget);
    expect(find.text('Editor'), findsWidgets);
  });

  testWidgets('removing an assigned role updates the current roles list', (
    WidgetTester tester,
  ) async {
    final effectivePermissions = <String>['user.manage', 'user.read', 'role.write'];
    final client = MockClient((request) async {
      final path = request.url.path;
      if (path.contains('/api/v1/users/user-1')) {
        return http.Response(
          jsonEncode({
            'user': {'id': 'user-1', 'username': 'demo'},
          }),
          200,
        );
      }
      if (path.endsWith('/api/v1/rbac/roles') && request.method == 'GET') {
        return http.Response(
          jsonEncode({
            'success': true,
            'roles': [
              {'id': 'role-1', 'name': 'Reader', 'description': 'Read only'},
              {'id': 'role-2', 'name': 'Editor', 'description': 'Can edit'},
            ],
          }),
          200,
        );
      }
      if (path.contains('/api/v1/rbac/roles/role-1/permissions') &&
          request.method == 'GET') {
        return http.Response(
          jsonEncode({
            'success': true,
            'permissions': [
              {'permissionKey': 'user.read'},
            ],
          }),
          200,
        );
      }
      if (path.contains('/api/v1/rbac/roles/role-2/permissions') &&
          request.method == 'GET') {
        return http.Response(
          jsonEncode({
            'success': true,
            'permissions': [
              {'permissionKey': 'role.write'},
            ],
          }),
          200,
        );
      }
      if (path.contains('/api/v1/rbac/users/user-1/effective-permissions')) {
        return http.Response(
          jsonEncode({'success': true, 'permissions': effectivePermissions}),
          200,
        );
      }
      if (path.contains('/api/v1/rbac/users/user-1/roles/role-2') &&
          request.method == 'DELETE') {
        effectivePermissions.remove('role.write');
        return http.Response(
          jsonEncode({'success': true, 'revoked': true}),
          200,
        );
      }
      return http.Response('not found', 404);
    });

    final api = ApiClient(baseUrl: 'http://example.com', httpClient: client);
    GetIt.instance.registerSingleton<ApiClient>(api);

    final authz = AuthZService();
    final auth = AuthService(
      secureStorage: _MemorySecureStorage(),
      apiClientFactory: (_) => api,
      authzService: authz,
    );
    GetIt.instance.registerSingleton<AuthService>(auth);
    await authz.loadPermissions(api, 'user-1');

    final userService = UserService(apiClient: api);
    GetIt.instance.registerSingleton<UserService>(userService);
    final roleService = RoleService(apiClient: api);
    GetIt.instance.registerSingleton<RoleService>(roleService);

    await tester.pumpWidget(
      MaterialApp(home: UserRoleAssignmentScreen(userId: 'user-1')),
    );
    await tester.pumpAndSettle();

    expect(find.text('Editor'), findsWidgets);

    await tester.tap(find.widgetWithText(ElevatedButton, 'Remove').last);
    await tester.pumpAndSettle();

    expect(find.text('Role removed'), findsOneWidget);
  });

  testWidgets('assign roles screen shows the user context and back navigation', (
    WidgetTester tester,
  ) async {
    final effectivePermissions = <String>['user.manage', 'user.read'];
    final client = MockClient((request) async {
      final path = request.url.path;

      if (path.contains('/api/v1/users/user-1')) {
        return http.Response(
          jsonEncode({
            'user': {'id': 'user-1', 'username': 'demo'},
          }),
          200,
        );
      }
      if (path.endsWith('/api/v1/rbac/roles') && request.method == 'GET') {
        return http.Response(
          jsonEncode({
            'success': true,
            'roles': [
              {'id': 'role-1', 'name': 'Reader', 'description': 'Read only'},
            ],
          }),
          200,
        );
      }
      if (path.contains('/api/v1/rbac/roles/role-1/permissions') &&
          request.method == 'GET') {
        return http.Response(
          jsonEncode({
            'success': true,
            'permissions': [
              {'permissionKey': 'user.read'},
            ],
          }),
          200,
        );
      }
      if (path.contains('/api/v1/rbac/users/user-1/effective-permissions')) {
        return http.Response(
          jsonEncode({'success': true, 'permissions': effectivePermissions}),
          200,
        );
      }
      return http.Response('not found', 404);
    });

    final api = ApiClient(baseUrl: 'http://example.com', httpClient: client);
    GetIt.instance.registerSingleton<ApiClient>(api);

    final authz = AuthZService();
    final auth = AuthService(
      secureStorage: _MemorySecureStorage(),
      apiClientFactory: (_) => api,
      authzService: authz,
    );
    GetIt.instance.registerSingleton<AuthService>(auth);
    await authz.loadPermissions(api, 'user-1');

    final userService = UserService(apiClient: api);
    GetIt.instance.registerSingleton<UserService>(userService);
    final roleService = RoleService(apiClient: api);
    GetIt.instance.registerSingleton<RoleService>(roleService);

    await tester.pumpWidget(
      MaterialApp(home: UserRoleAssignmentScreen(userId: 'user-1')),
    );
    await tester.pumpAndSettle();

    expect(find.text('Assign Roles'), findsOneWidget);
    expect(find.byIcon(Icons.arrow_back_outlined), findsOneWidget);
    expect(find.textContaining('Managing roles for: demo'), findsOneWidget);
  });
}
