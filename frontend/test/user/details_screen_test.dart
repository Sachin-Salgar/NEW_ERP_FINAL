import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'package:new_erp_final_frontend/core/auth/auth_service.dart';
import 'package:new_erp_final_frontend/core/auth/authz_service.dart';
import 'package:new_erp_final_frontend/core/network/api_client.dart';
import 'package:new_erp_final_frontend/modules/branch/branch_service.dart';
import 'package:new_erp_final_frontend/modules/organization/organization_service.dart';
import 'package:new_erp_final_frontend/modules/role/role_service.dart';
import 'package:new_erp_final_frontend/modules/user/details_screen.dart';
import 'package:new_erp_final_frontend/modules/user/user_service.dart';

class _MemorySecureStorage implements SecureStorageLike {
  @override
  Future<String?> read({required String key}) async => null;

  @override
  Future<void> write({required String key, required String value}) async {}

  @override
  Future<void> delete({required String key}) async {}
}

void main() {
  setUp(() => GetIt.instance.reset());
  tearDown(() => GetIt.instance.reset());

  testWidgets('renders summary and all user detail cards together', (
    WidgetTester tester,
  ) async {
    final client = MockClient((request) async {
      if (request.url.path == '/api/v1/users/user-1') {
        return http.Response(
          jsonEncode({
            'user': {
              'id': 'user-1',
              'username': 'demo',
              'email': 'demo@example.com',
              'status': 'active',
            },
          }),
          200,
        );
      }
      if (request.url.path == '/api/v1/organizations') {
        return http.Response(jsonEncode({'organizations': []}), 200);
      }
      if (request.url.path == '/api/v1/users/user-1/access') {
        return http.Response(
          jsonEncode({
            'success': true,
            'userId': 'user-1',
            'organizations': [
              {'id': 'org-1', 'name': 'Assigned Org'},
            ],
            'branches': [
              {
                'id': 'branch-1',
                'name': 'Assigned Branch',
                'organizationId': 'org-1',
                'organizationName': 'Assigned Org',
              },
            ],
          }),
          200,
        );
      }
      if (request.url.path ==
          '/api/v1/rbac/users/user-1/effective-permissions') {
        return http.Response(
          jsonEncode({
            'success': true,
            'permissions': ['user.manage'],
          }),
          200,
        );
      }
      return http.Response('{}', 200);
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
    GetIt.instance.registerSingleton<UserService>(UserService(apiClient: api));
    GetIt.instance.registerSingleton<RoleService>(RoleService(apiClient: api));
    GetIt.instance.registerSingleton<OrganizationService>(
      OrganizationService(apiClient: api),
    );
    GetIt.instance.registerSingleton<BranchService>(
      BranchService(apiClient: api),
    );

    await tester.pumpWidget(
      const MaterialApp(home: UserDetailsScreen(id: 'user-1')),
    );
    await tester.pumpAndSettle();

    expect(find.text('demo'), findsWidgets);
    expect(find.text('Profile'), findsOneWidget);
    expect(find.text('Roles'), findsOneWidget);
    expect(find.text('Access'), findsOneWidget);
    expect(find.text('1 organization • 1 branch'), findsOneWidget);
    await tester.ensureVisible(find.text('Hide Access'));
    await tester.tap(find.text('Hide Access'));
    await tester.pump();
    expect(find.text('Manage Access'), findsOneWidget);
    expect(find.text('1 organization • 1 branch'), findsOneWidget);
    await tester.tap(find.text('Manage Access'));
    await tester.pump();
    expect(find.text('Hide Access'), findsOneWidget);
    expect(find.text('Assign Organization'), findsOneWidget);
    expect(find.text('Account details'), findsOneWidget);
    expect(find.byType(TabBar), findsNothing);

    await tester.ensureVisible(find.text('Hide Roles'));
    await tester.tap(find.text('Hide Roles'));
    await tester.pump();
    expect(find.text('Manage Roles'), findsOneWidget);

    await tester.tap(find.text('Manage Roles'));
    await tester.pump();
    expect(find.text('Hide Roles'), findsOneWidget);
  });

  testWidgets(
    'shows the current assigned roles when the Roles card is collapsed',
    (WidgetTester tester) async {
      final client = MockClient((request) async {
        final path = request.url.path;
        if (path == '/api/v1/users/user-1') {
          return http.Response(
            jsonEncode({
              'user': {
                'id': 'user-1',
                'username': 'demo',
                'email': 'demo@example.com',
                'status': 'active',
              },
            }),
            200,
          );
        }
        if (path == '/api/v1/organizations') {
          return http.Response(jsonEncode({'organizations': []}), 200);
        }
        if (path == '/api/v1/rbac/roles') {
          return http.Response(
            jsonEncode({
              'success': true,
              'roles': [
                {'id': 'role-1', 'name': 'Administrator'},
                {'id': 'role-2', 'name': 'Manager'},
              ],
            }),
            200,
          );
        }
        if (path == '/api/v1/rbac/users/user-1/roles') {
          return http.Response(
            jsonEncode({
              'success': true,
              'userId': 'user-1',
              'roles': [
                {'id': 'role-1', 'name': 'Administrator'},
                {'id': 'role-2', 'name': 'Manager'},
              ],
            }),
            200,
          );
        }
        if (path == '/api/v1/rbac/users/user-1/effective-permissions') {
          return http.Response(
            jsonEncode({
              'success': true,
              'permissions': ['user.manage'],
            }),
            200,
          );
        }
        return http.Response('{}', 200);
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
      GetIt.instance.registerSingleton<UserService>(
        UserService(apiClient: api),
      );
      GetIt.instance.registerSingleton<RoleService>(
        RoleService(apiClient: api),
      );
      GetIt.instance.registerSingleton<OrganizationService>(
        OrganizationService(apiClient: api),
      );
      GetIt.instance.registerSingleton<BranchService>(
        BranchService(apiClient: api),
      );

      await tester.pumpWidget(
        const MaterialApp(home: UserDetailsScreen(id: 'user-1')),
      );
      await tester.pumpAndSettle();

      await tester.ensureVisible(find.text('Hide Roles'));
      await tester.tap(find.text('Hide Roles'));
      await tester.pump();

      expect(find.textContaining('2 roles assigned'), findsOneWidget);
      expect(find.textContaining('Administrator • Manager'), findsOneWidget);
      expect(find.text('Manage Roles'), findsOneWidget);
    },
  );
}
