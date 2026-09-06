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

class _Storage implements SecureStorageLike {
  final Map<String, String> values = {};
  @override
  Future<String?> read({required String key}) async => values[key];
  @override
  Future<void> write({required String key, required String value}) async =>
      values[key] = value;
  @override
  Future<void> delete({required String key}) async => values.remove(key);
}

Future<void> _setup(MockClient client) async {
  final api = ApiClient(baseUrl: 'http://example.com', httpClient: client);
  final authz = AuthZService();
  final auth = AuthService(
    secureStorage: _Storage(),
    apiClientFactory: (_) => api,
    authzService: authz,
  );
  GetIt.instance.registerSingleton<ApiClient>(api);
  GetIt.instance.registerSingleton<AuthService>(auth);
  await authz.loadPermissions(api, 'user-1');
}

void main() {
  setUp(() => GetIt.instance.reset());
  tearDown(() => GetIt.instance.reset());

  testWidgets('shows role, category and action type selectors in one row', (
    tester,
  ) async {
    await _setup(_mock());
    await tester.pumpWidget(
      MaterialApp(home: RolePermissionScreen(roleId: 'role-1')),
    );
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey('role-selector')), findsOneWidget);
    expect(find.byKey(const ValueKey('category-selector')), findsOneWidget);
    expect(find.byKey(const ValueKey('action-type-selector')), findsOneWidget);
    expect(find.byType(DataTable), findsOneWidget);
    expect(find.text('Common Actions'), findsOneWidget);
    expect(find.text('User Management'), findsOneWidget);
    expect(find.text('Purchase'), findsAtLeastNWidgets(1));
    expect(find.byKey(const ValueKey('permission:user.read')), findsNothing);
    expect(find.text('Manage'), findsNothing);
  });

  testWidgets('derives granular User business actions from the catalog', (
    tester,
  ) async {
    await _setup(_mock());
    await tester.pumpWidget(
      MaterialApp(home: RolePermissionScreen(roleId: 'role-1')),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const ValueKey('category-selector')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('User Management').last);
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('action-type-selector')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Business Actions').last);
    await tester.pumpAndSettle();

    expect(find.text('Activate'), findsOneWidget);
    expect(find.text('Deactivate'), findsOneWidget);
    expect(find.text('Manage'), findsNothing);
  });

  testWidgets('business action selector swaps columns without changing tree', (
    tester,
  ) async {
    await _setup(_mock());
    await tester.pumpWidget(
      MaterialApp(home: RolePermissionScreen(roleId: 'role-1')),
    );
    await tester.pumpAndSettle();

    expect(find.text('Approve'), findsNothing);
    await tester.tap(find.byKey(const ValueKey('action-type-selector')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Business Actions').last);
    await tester.pumpAndSettle();

    expect(find.text('Approve'), findsOneWidget);
    expect(find.text('Reject'), findsOneWidget);
    expect(find.text('Purchase'), findsAtLeastNWidgets(1));
    expect(find.byType(DataTable), findsOneWidget);
  });

  testWidgets('category selector filters the same single table', (
    tester,
  ) async {
    await _setup(_mock());
    await tester.pumpWidget(
      MaterialApp(home: RolePermissionScreen(roleId: 'role-1')),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const ValueKey('category-selector')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Purchase').last);
    await tester.pumpAndSettle();

    expect(find.text('Purchase'), findsAtLeastNWidgets(1));
    expect(find.text('User Management'), findsNothing);
    expect(find.byType(DataTable), findsOneWidget);
  });
}

MockClient _mock() {
  final roles = [
    {'id': 'role-1', 'name': 'Administrator', 'code': 'admin'},
  ];
  final permissions = [
    {
      'permissionKey': 'user.read',
      'moduleCode': 'user-management',
      'resource': 'user',
      'action': 'read',
      'displayName': 'View Users',
    },
    {
      'permissionKey': 'user.create',
      'moduleCode': 'user-management',
      'resource': 'user',
      'action': 'create',
      'displayName': 'Create Users',
    },
    {
      'permissionKey': 'user.update',
      'moduleCode': 'user-management',
      'resource': 'user',
      'action': 'update',
      'displayName': 'Update Users',
    },
    {
      'permissionKey': 'user.activate',
      'moduleCode': 'user-management',
      'resource': 'user',
      'action': 'activate',
      'displayName': 'Activate Users',
    },
    {
      'permissionKey': 'user.deactivate',
      'moduleCode': 'user-management',
      'resource': 'user',
      'action': 'deactivate',
      'displayName': 'Deactivate Users',
    },
    {
      'permissionKey': 'role.create',
      'moduleCode': 'security',
      'resource': 'role',
      'action': 'manage',
      'displayName': 'Manage Roles',
    },
    {
      'permissionKey': 'purchase.purchase_order.read',
      'moduleCode': 'purchase',
      'resource': 'purchase_order',
      'action': 'read',
      'displayName': 'View Purchase Orders',
    },
    {
      'permissionKey': 'purchase.purchase_order.approve',
      'moduleCode': 'purchase',
      'resource': 'purchase_order',
      'action': 'approve',
      'displayName': 'Approve Purchase Orders',
    },
    {
      'permissionKey': 'purchase.purchase_order.reject',
      'moduleCode': 'purchase',
      'resource': 'purchase_order',
      'action': 'reject',
      'displayName': 'Reject Purchase Orders',
    },
  ];
  return MockClient((request) async {
    final path = request.url.path;
    if (path == '/api/v1/rbac/roles' && request.method == 'GET') {
      return http.Response(jsonEncode({'success': true, 'roles': roles}), 200);
    }
    if (path == '/api/v1/rbac/permissions' && request.method == 'GET') {
      return http.Response(
        jsonEncode({'success': true, 'permissions': permissions}),
        200,
      );
    }
    if (path == '/api/v1/rbac/roles/role-1' && request.method == 'GET') {
      return http.Response(
        jsonEncode({'success': true, 'role': roles.first}),
        200,
      );
    }
    if (path == '/api/v1/rbac/roles/role-1/permissions' &&
        request.method == 'GET') {
      return http.Response(
        jsonEncode({'success': true, 'permissions': []}),
        200,
      );
    }
    if (path.contains('/effective-permissions')) {
      return http.Response(
        jsonEncode({
          'success': true,
          'permissions': ['role.create'],
        }),
        200,
      );
    }
    return http.Response('not found', 404);
  });
}
