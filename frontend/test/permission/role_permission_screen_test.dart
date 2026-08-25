import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:http/testing.dart';
import 'package:http/http.dart' as http;

import 'package:new_erp_final_frontend/core/network/api_client.dart';
import 'package:new_erp_final_frontend/core/auth/auth_service.dart';
import 'package:new_erp_final_frontend/core/auth/authz_service.dart';
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

void main() {
  setUp(() {
    GetIt.instance.reset();
  });

  tearDown(() {
    GetIt.instance.reset();
  });

  testWidgets('loads permissions and assigned state; assign/unassign flow', (WidgetTester tester) async {
    // Simulate backend: GET /rbac/permissions returns two permissions, GET /rbac/roles/role-1/permissions returns one assigned
    // POST assigns one, DELETE removes one
    var assigned = ['perm.a'];

    final client = MockClient((request) async {
      final path = request.url.path;
      if (path.contains('/rbac/permissions') && request.method == 'GET') {
        return http.Response(jsonEncode({
          'success': true,
          'permissions': ['perm.a', 'perm.b']
        }), 200);
      }

      if (path.contains('/rbac/roles/role-1/permissions') && request.method == 'GET') {
        return http.Response(jsonEncode({
          'success': true,
          'permissions': assigned.map((k) => {'permissionKey': k}).toList()
        }), 200);
      }

      if (path.contains('/rbac/roles/role-1/permissions') && request.method == 'POST') {
        final body = jsonDecode(request.body) as Map<String, dynamic>;
        final keys = List<String>.from(body['permissionKeys'] as List<dynamic>);
        assigned = [...assigned, ...keys];
        return http.Response(jsonEncode({'success': true, 'assigned': keys.length}), 200);
      }

      if (path.contains('/rbac/roles/role-1/permissions') && request.method == 'DELETE') {
        final body = jsonDecode(request.body) as Map<String, dynamic>;
        final keys = List<String>.from(body['permissionKeys'] as List<dynamic>);
        assigned = assigned.where((k) => !keys.contains(k)).toList();
        return http.Response(jsonEncode({'success': true, 'removed': keys.length}), 200);
      }

      if (path.contains('/effective-permissions')) {
        return http.Response(jsonEncode({'success': true, 'userId': 'user-1', 'permissions': ['role.manage']}), 200);
      }

      return http.Response('not found', 404);
    });

    final api = ApiClient(baseUrl: 'http://example.com', httpClient: client);
    GetIt.instance.registerSingleton<ApiClient>(api);

    final authz = AuthZService();
    final auth = AuthService(secureStorage: _MemorySecureStorage(), apiClientFactory: (baseUrl) => api, authzService: authz);
    GetIt.instance.registerSingleton<AuthService>(auth);
    await authz.loadPermissions(api, 'user-1');

    await tester.pumpWidget(MaterialApp(home: RolePermissionScreen(roleId: 'role-1')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 200));
    await tester.pumpAndSettle();

    // Should show both permissions
    expect(find.text('perm.a'), findsOneWidget);
    expect(find.text('perm.b'), findsOneWidget);

    // perm.a is assigned, so remove button should be present (by tooltip)
    expect(find.byTooltip('Remove permission'), findsOneWidget);

    // Assign perm.b
    await tester.tap(find.byTooltip('Assign permission').first);
    await tester.pumpAndSettle();

    // Now perm.b should show remove button as well
    expect(find.byTooltip('Remove permission'), findsNWidgets(2));

    // Remove perm.a
    await tester.tap(find.byTooltip('Remove permission').first);
    await tester.pumpAndSettle();

    // Now only one remove remains
    expect(find.byTooltip('Remove permission'), findsOneWidget);
  });
}
