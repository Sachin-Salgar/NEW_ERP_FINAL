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
import 'package:new_erp_final_frontend/modules/user/components/user_roles_section.dart';
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

Future<void> _pumpRoleAssignmentScreen(
  WidgetTester tester,
  MockClient client,
) async {
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

  GetIt.instance.registerSingleton<UserService>(UserService(apiClient: api));
  GetIt.instance.registerSingleton<RoleService>(RoleService(apiClient: api));

  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(body: UserRolesSection(userId: 'user-1')),
    ),
  );
  await tester.pumpAndSettle();
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
      MaterialApp(
        home: Scaffold(body: UserRolesSection(userId: 'user-1')),
      ),
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
    var roleAssigned = false;
    List<String>? assignedRoleNames;
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
      if (path.endsWith('/api/v1/rbac/users/user-1/roles') &&
          request.method == 'GET') {
        final roles = roleAssigned
            ? [
                {'id': 'role-2', 'name': 'Editor', 'description': 'Can edit'},
              ]
            : <Map<String, dynamic>>[];
        return http.Response(
          jsonEncode({'success': true, 'userId': 'user-1', 'roles': roles}),
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
        roleAssigned = true;
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
      MaterialApp(
        home: Scaffold(
          body: UserRolesSection(
            userId: 'user-1',
            onAssignedRoleNamesChanged: (names) => assignedRoleNames = names,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(assignedRoleNames, isEmpty);
    expect(find.text('Reader'), findsWidgets);
    expect(find.text('Editor'), findsOneWidget);

    await tester.tap(find.widgetWithText(ElevatedButton, 'Assign').first);
    await tester.pumpAndSettle();

    expect(find.text('Role assigned'), findsOneWidget);
    expect(assignedRoleNames, ['Editor']);
    expect(find.text('Editor'), findsOneWidget);
    expect(find.widgetWithText(ElevatedButton, 'Assign'), findsOneWidget);
    expect(find.widgetWithText(ElevatedButton, 'Remove'), findsOneWidget);
  });

  testWidgets('removing an assigned role updates the current roles list', (
    WidgetTester tester,
  ) async {
    final effectivePermissions = <String>[
      'user.manage',
      'user.read',
      'role.write',
    ];
    var roleRemoved = false;
    List<String>? assignedRoleNames;
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
            'userId': 'user-1',
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
      if (path.endsWith('/api/v1/rbac/users/user-1/roles') &&
          request.method == 'GET') {
        return http.Response(
          jsonEncode({
            'success': true,
            'userId': 'user-1',
            'roles': roleRemoved
                ? <Map<String, String>>[]
                : [
                    {
                      'id': 'role-2',
                      'name': 'Editor',
                      'description': 'Can edit',
                    },
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
        roleRemoved = true;
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
      MaterialApp(
        home: Scaffold(
          body: UserRolesSection(
            userId: 'user-1',
            onAssignedRoleNamesChanged: (names) => assignedRoleNames = names,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Editor'), findsOneWidget);
    expect(assignedRoleNames, ['Editor']);

    await tester.tap(find.widgetWithText(ElevatedButton, 'Remove').last);
    await tester.pumpAndSettle();

    expect(find.text('Role removed'), findsOneWidget);
    expect(assignedRoleNames, isEmpty);
  });

  testWidgets('roles section shows available roles', (
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
      if (path.endsWith('/api/v1/rbac/users/user-1/roles') &&
          request.method == 'GET') {
        return http.Response(
          jsonEncode({'success': true, 'userId': 'user-1', 'roles': []}),
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
      MaterialApp(
        home: Scaffold(body: UserRolesSection(userId: 'user-1')),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Available roles'), findsOneWidget);
    expect(find.text('Reader'), findsOneWidget);
  });

  testWidgets('empty assigned roles display the empty state', (
    WidgetTester tester,
  ) async {
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
      if (path.endsWith('/api/v1/rbac/roles')) {
        return http.Response(jsonEncode({'success': true, 'roles': []}), 200);
      }
      if (path.endsWith('/api/v1/rbac/users/user-1/roles')) {
        return http.Response(
          jsonEncode({'success': true, 'userId': 'user-1', 'roles': []}),
          200,
        );
      }
      if (path.contains('/api/v1/rbac/users/user-1/effective-permissions')) {
        return http.Response(
          jsonEncode({
            'success': true,
            'permissions': ['user.manage'],
          }),
          200,
        );
      }
      return http.Response('not found', 404);
    });

    await _pumpRoleAssignmentScreen(tester, client);

    expect(find.text('No roles assigned.'), findsOneWidget);
  });

  testWidgets('role retrieval HTTP failures show an error state', (
    WidgetTester tester,
  ) async {
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
      if (path.endsWith('/api/v1/rbac/roles')) {
        return http.Response(jsonEncode({'success': true, 'roles': []}), 200);
      }
      if (path.endsWith('/api/v1/rbac/users/user-1/roles')) {
        return http.Response('server error', 500);
      }
      if (path.contains('/api/v1/rbac/users/user-1/effective-permissions')) {
        return http.Response(
          jsonEncode({
            'success': true,
            'permissions': ['user.manage'],
          }),
          200,
        );
      }
      return http.Response('not found', 404);
    });

    await _pumpRoleAssignmentScreen(tester, client);

    expect(
      find.textContaining('Failed to load assigned roles: 500'),
      findsOneWidget,
    );
    expect(find.text('No roles assigned.'), findsNothing);
  });

  testWidgets('unsuccessful role responses show an error state', (
    WidgetTester tester,
  ) async {
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
      if (path.endsWith('/api/v1/rbac/roles')) {
        return http.Response(jsonEncode({'success': true, 'roles': []}), 200);
      }
      if (path.endsWith('/api/v1/rbac/users/user-1/roles')) {
        return http.Response(
          jsonEncode({'success': false, 'userId': 'user-1', 'roles': []}),
          200,
        );
      }
      if (path.contains('/api/v1/rbac/users/user-1/effective-permissions')) {
        return http.Response(
          jsonEncode({
            'success': true,
            'permissions': ['user.manage'],
          }),
          200,
        );
      }
      return http.Response('not found', 404);
    });

    await _pumpRoleAssignmentScreen(tester, client);

    expect(
      find.textContaining('Invalid assigned roles response'),
      findsOneWidget,
    );
    expect(find.text('No roles assigned.'), findsNothing);
  });

  testWidgets('mismatched role response user IDs show an error state', (
    WidgetTester tester,
  ) async {
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
      if (path.endsWith('/api/v1/rbac/roles')) {
        return http.Response(jsonEncode({'success': true, 'roles': []}), 200);
      }
      if (path.endsWith('/api/v1/rbac/users/user-1/roles')) {
        return http.Response(
          jsonEncode({'success': true, 'userId': 'user-2', 'roles': []}),
          200,
        );
      }
      if (path.contains('/api/v1/rbac/users/user-1/effective-permissions')) {
        return http.Response(
          jsonEncode({
            'success': true,
            'permissions': ['user.manage'],
          }),
          200,
        );
      }
      return http.Response('not found', 404);
    });

    await _pumpRoleAssignmentScreen(tester, client);

    expect(
      find.textContaining('Invalid assigned roles response'),
      findsOneWidget,
    );
    expect(find.text('No roles assigned.'), findsNothing);
  });

  testWidgets('role retrieval network failures show an error state', (
    WidgetTester tester,
  ) async {
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
      if (path.endsWith('/api/v1/rbac/roles')) {
        return http.Response(jsonEncode({'success': true, 'roles': []}), 200);
      }
      if (path.endsWith('/api/v1/rbac/users/user-1/roles')) {
        throw Exception('network failure');
      }
      if (path.contains('/api/v1/rbac/users/user-1/effective-permissions')) {
        return http.Response(
          jsonEncode({
            'success': true,
            'permissions': ['user.manage'],
          }),
          200,
        );
      }
      return http.Response('not found', 404);
    });

    await _pumpRoleAssignmentScreen(tester, client);

    expect(find.textContaining('network failure'), findsOneWidget);
    expect(find.text('No roles assigned.'), findsNothing);
  });

  testWidgets('malformed role retrieval responses show an error state', (
    WidgetTester tester,
  ) async {
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
      if (path.endsWith('/api/v1/rbac/roles')) {
        return http.Response(jsonEncode({'success': true, 'roles': []}), 200);
      }
      if (path.endsWith('/api/v1/rbac/users/user-1/roles')) {
        return http.Response(
          jsonEncode({'success': true, 'roles': 'not-a-list'}),
          200,
        );
      }
      if (path.contains('/api/v1/rbac/users/user-1/effective-permissions')) {
        return http.Response(
          jsonEncode({
            'success': true,
            'permissions': ['user.manage'],
          }),
          200,
        );
      }
      return http.Response('not found', 404);
    });

    await _pumpRoleAssignmentScreen(tester, client);

    expect(
      find.textContaining('Invalid assigned roles response'),
      findsOneWidget,
    );
    expect(find.text('No roles assigned.'), findsNothing);
  });
}
