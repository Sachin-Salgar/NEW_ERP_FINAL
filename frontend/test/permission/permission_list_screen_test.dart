import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:http/testing.dart';
import 'package:http/http.dart' as http;

import 'package:new_erp_final_frontend/core/network/api_client.dart';
import 'package:new_erp_final_frontend/core/auth/authz_service.dart';
import 'package:new_erp_final_frontend/modules/permission/permission_list_screen.dart';

import '../test_utils.dart';

void main() {
  setUp(() {
    GetIt.instance.reset();
  });

  testWidgets('Permission list renders and navigates to detail', (WidgetTester tester) async {
    final mockClient = MockClient((request) async {
      if (request.url.path.contains('/rbac/permissions')) {
        return http.Response(jsonEncode({'permissions': ['perm.read', 'perm.write']}), 200);
      }
      if (request.url.path.contains('/effective-permissions')) {
        return http.Response(jsonEncode({'permissions': ['permission.read']}), 200);
      }
      return http.Response('{}', 200);
    });

    final apiClient = ApiClient(baseUrl: 'http://example.com', httpClient: mockClient);
    registerTestServices(apiClient: apiClient);

    final authz = GetIt.instance.get<AuthZService>();
    await authz.loadPermissions(apiClient, 'user-id');

    await tester.pumpWidget(TestApp(child: PermissionListScreen()));
    await tester.pumpAndSettle();

    expect(find.text('perm.read'), findsOneWidget);
    expect(find.text('perm.write'), findsOneWidget);

    await tester.tap(find.text('perm.read'));
    await tester.pumpAndSettle();

    expect(find.text('perm.read'), findsWidgets);
  });

  testWidgets('Permission list shows permission denied', (WidgetTester tester) async {
    final mockClient = MockClient((request) async {
      if (request.url.path.contains('/rbac/permissions')) {
        return http.Response(jsonEncode({'permissions': ['perm.read']}), 200);
      }
      if (request.url.path.contains('/effective-permissions')) {
        return http.Response(jsonEncode({'permissions': []}), 200);
      }
      return http.Response('{}', 200);
    });

    final apiClient = ApiClient(baseUrl: 'http://example.com', httpClient: mockClient);
    registerTestServices(apiClient: apiClient);

    final authz = GetIt.instance.get<AuthZService>();
    await authz.loadPermissions(apiClient, 'user-id');

    await tester.pumpWidget(TestApp(child: PermissionListScreen()));
    await tester.pumpAndSettle();

    expect(find.text('You do not have permission to view permissions.'), findsOneWidget);
  });

  testWidgets('Permission list shows error on server failure', (WidgetTester tester) async {
    final mockClient = MockClient((request) async {
      if (request.url.path.contains('/rbac/permissions')) {
        return http.Response('Internal Server Error', 500);
      }
      if (request.url.path.contains('/effective-permissions')) {
        return http.Response(jsonEncode({'permissions': ['permission.read']}), 200);
      }
      return http.Response('{}', 200);
    });

    final apiClient = ApiClient(baseUrl: 'http://example.com', httpClient: mockClient);
    registerTestServices(apiClient: apiClient);

    final authz = GetIt.instance.get<AuthZService>();
    await authz.loadPermissions(apiClient, 'user-id');

    await tester.pumpWidget(TestApp(child: PermissionListScreen()));
    await tester.pumpAndSettle();

    expect(find.textContaining('Failed to load permissions'), findsOneWidget);
  });
}
