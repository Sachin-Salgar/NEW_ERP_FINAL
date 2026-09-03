import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'package:new_erp_final_frontend/core/auth/auth_service.dart';
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
      return http.Response('{}', 200);
    });
    final api = ApiClient(baseUrl: 'http://example.com', httpClient: client);
    GetIt.instance.registerSingleton<ApiClient>(api);
    GetIt.instance.registerSingleton<AuthService>(
      AuthService(
        secureStorage: _MemorySecureStorage(),
        apiClientFactory: (_) => api,
      ),
    );
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
}
