import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:http/testing.dart';
import 'package:http/http.dart' as http;

import 'package:new_erp_final_frontend/core/auth/auth_service.dart';
import 'package:new_erp_final_frontend/core/auth/authz_service.dart';
import 'package:new_erp_final_frontend/core/network/api_client.dart';
import 'package:new_erp_final_frontend/modules/permission/role_permission_screen.dart';

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

Future<void> _configureAuth(ApiClient api) async {
  final authz = AuthZService();
  final auth = AuthService(secureStorage: _MemorySecureStorage(), apiClientFactory: (baseUrl) => api, authzService: authz);
  GetIt.instance.registerSingleton<AuthService>(auth);
  await authz.loadPermissions(api, 'user-1');
}

void main() {
  setUp(() {
    GetIt.instance.reset();
  });

  tearDown(() {
    GetIt.instance.reset();
  });

  testWidgets('loads roles, shows metadata-driven permission names, and filters by module', (WidgetTester tester) async {
    final roles = [
      {'id': 'role-admin', 'name': 'Administrator', 'code': 'admin'},
      {'id': 'role-user', 'name': 'User manager', 'code': 'user-manager'},
    ];
    final permissions = [
      {
        'permissionKey': 'user.read',
        'moduleCode': 'user-management',
        'resource': 'user',
        'action': 'read',
        'displayName': 'View Users',
        'description': 'View user account records.',
      },
      {
        'permissionKey': 'user.create',
        'moduleCode': 'user-management',
        'resource': 'user',
        'action': 'create',
        'displayName': 'Create Users',
        'description': 'Create new user accounts.',
      },
      {
        'permissionKey': 'role.manage',
        'moduleCode': 'security',
        'resource': 'role',
        'action': 'manage',
        'displayName': 'Manage Roles',
        'description': 'Manage role assignments.',
      },
    ];
    var assigned = ['user.read'];

    final client = MockClient((request) async {
      final path = request.url.path;
      if (path == '/api/v1/rbac/roles' && request.method == 'GET') {
        return http.Response(jsonEncode({'success': true, 'roles': roles}), 200);
      }
      if (path == '/api/v1/rbac/permissions' && request.method == 'GET') {
        return http.Response(jsonEncode({'success': true, 'permissions': permissions}), 200);
      }
      if (path == '/api/v1/rbac/roles/role-admin' && request.method == 'GET') {
        return http.Response(jsonEncode({'success': true, 'role': roles.first}), 200);
      }
      if (path == '/api/v1/rbac/roles/role-admin/permissions' && request.method == 'GET') {
        return http.Response(jsonEncode({'success': true, 'permissions': assigned.map((key) => {'permissionKey': key}).toList()}), 200);
      }
      if (path == '/api/v1/rbac/roles/role-admin/permissions' && request.method == 'PUT') {
        final body = jsonDecode(request.body) as Map<String, dynamic>;
        final keys = List<String>.from(body['permissionKeys'] as List<dynamic>);
        assigned = keys;
        return http.Response(jsonEncode({'success': true, 'replaced': keys.length}), 200);
      }
      if (path.contains('/effective-permissions')) {
        return http.Response(jsonEncode({'success': true, 'userId': 'user-1', 'permissions': ['role.manage']}), 200);
      }
      return http.Response('not found', 404);
    });

    final api = ApiClient(baseUrl: 'http://example.com', httpClient: client);
    GetIt.instance.registerSingleton<ApiClient>(api);
    await _configureAuth(api);

    await tester.pumpWidget(MaterialApp(home: RolePermissionScreen(roleId: 'role-admin')));
    await tester.pumpAndSettle();

    expect(find.text('Administrator'), findsOneWidget);
    expect(find.text('View Users'), findsOneWidget);
    expect(find.text('Manage Roles'), findsOneWidget);
    expect(find.text('Create Users'), findsOneWidget);

    await tester.tap(find.byType(DropdownButtonFormField<String>).at(1));
    await tester.pumpAndSettle();
    await tester.tap(find.text('User Management').last);
    await tester.pumpAndSettle();
    expect(find.text('View Users'), findsOneWidget);
    expect(find.text('Create Users'), findsOneWidget);

    expect(find.byType(CheckboxListTile), findsWidgets);
  });

  testWidgets('changing the selected role swaps the permission set and preserves current state', (WidgetTester tester) async {
    final roles = [
      {'id': 'role-one', 'name': 'Role One', 'code': 'role-1'},
      {'id': 'role-two', 'name': 'Role Two', 'code': 'role-2'},
    ];
    final permissions = [
      {'permissionKey': 'user.read', 'moduleCode': 'user-management', 'resource': 'user', 'action': 'read', 'displayName': 'View Users'},
      {'permissionKey': 'user.create', 'moduleCode': 'user-management', 'resource': 'user', 'action': 'create', 'displayName': 'Create Users'},
      {'permissionKey': 'role.manage', 'moduleCode': 'security', 'resource': 'role', 'action': 'manage', 'displayName': 'Manage Roles'},
    ];
    final assignedByRole = {
      'role-one': ['user.read'],
      'role-two': ['role.manage'],
    };

    final client = MockClient((request) async {
      final path = request.url.path;
      if (path == '/api/v1/rbac/roles' && request.method == 'GET') {
        return http.Response(jsonEncode({'success': true, 'roles': roles}), 200);
      }
      if (path == '/api/v1/rbac/permissions' && request.method == 'GET') {
        return http.Response(jsonEncode({'success': true, 'permissions': permissions}), 200);
      }
      if (path.startsWith('/api/v1/rbac/roles/') && request.method == 'GET' && path.endsWith('/permissions')) {
        final roleId = path.split('/')[5];
        final assigned = assignedByRole[roleId] ?? <String>[];
        return http.Response(jsonEncode({'success': true, 'permissions': assigned.map((key) => {'permissionKey': key}).toList()}), 200);
      }
      if (path.startsWith('/api/v1/rbac/roles/') && request.method == 'GET' && !path.endsWith('/permissions')) {
        final roleId = path.split('/')[5];
        final role = roles.firstWhere((item) => item['id'] == roleId, orElse: () => roles.first);
        return http.Response(jsonEncode({'success': true, 'role': role}), 200);
      }
      if (path.startsWith('/api/v1/rbac/roles/') && request.method == 'PUT' && path.endsWith('/permissions')) {
        final roleId = path.split('/')[5];
        final body = jsonDecode(request.body) as Map<String, dynamic>;
        final keys = List<String>.from(body['permissionKeys'] as List<dynamic>);
        assignedByRole[roleId] = keys;
        return http.Response(jsonEncode({'success': true, 'replaced': keys.length}), 200);
      }
      if (path.contains('/effective-permissions')) {
        return http.Response(jsonEncode({'success': true, 'userId': 'user-1', 'permissions': ['role.manage']}), 200);
      }
      return http.Response('not found', 404);
    });

    final api = ApiClient(baseUrl: 'http://example.com', httpClient: client);
    GetIt.instance.registerSingleton<ApiClient>(api);
    await _configureAuth(api);

    await tester.pumpWidget(MaterialApp(home: RolePermissionScreen(roleId: 'role-one')));
    await tester.pumpAndSettle();

    expect(find.text('Role One'), findsOneWidget);
    expect(find.text('View Users'), findsOneWidget);
    expect(find.text('Create Users'), findsOneWidget);

    await tester.pumpWidget(MaterialApp(home: RolePermissionScreen(roleId: 'role-two')));
    await tester.pumpAndSettle();

    final tilesAfter = tester.widgetList<CheckboxListTile>(find.byType(CheckboxListTile));
    final viewUsersTileAfter = tilesAfter.firstWhere(
      (tile) => (tile.title as Text).data == 'View Users',
    );
    final manageRolesTileAfter = tilesAfter.firstWhere(
      (tile) => (tile.title as Text).data == 'Manage Roles',
    );

    expect(find.text('Role Two'), findsOneWidget);
    expect(manageRolesTileAfter.value, isTrue);
    expect(viewUsersTileAfter.value, isFalse);
  });

  testWidgets('shows an invalid role message when the role does not exist', (WidgetTester tester) async {
    final client = MockClient((request) async {
      final path = request.url.path;
      if (path == '/api/v1/rbac/roles' && request.method == 'GET') {
        return http.Response(jsonEncode({'success': true, 'roles': []}), 200);
      }
      if (path == '/api/v1/rbac/permissions' && request.method == 'GET') {
        return http.Response(jsonEncode({'success': true, 'permissions': []}), 200);
      }
      if (path == '/api/v1/rbac/roles/missing-role' && request.method == 'GET') {
        return http.Response(jsonEncode({'success': false, 'message': 'Role not found.'}), 404);
      }
      if (path.contains('/effective-permissions')) {
        return http.Response(jsonEncode({'success': true, 'userId': 'user-1', 'permissions': ['role.manage']}), 200);
      }
      return http.Response('not found', 404);
    });

    final api = ApiClient(baseUrl: 'http://example.com', httpClient: client);
    GetIt.instance.registerSingleton<ApiClient>(api);
    await _configureAuth(api);

    await tester.pumpWidget(MaterialApp(home: RolePermissionScreen(roleId: 'missing-role')));
    await tester.pumpAndSettle();

    expect(find.text('Role not found. Please return to the roles list and choose a valid role.'), findsOneWidget);
  });
}
