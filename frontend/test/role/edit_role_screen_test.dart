import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:http/testing.dart';
import 'package:http/http.dart' as http;

import 'package:new_erp_final_frontend/core/network/api_client.dart';
import 'package:new_erp_final_frontend/core/auth/authz_service.dart';
import 'package:new_erp_final_frontend/modules/role/edit_screen.dart';

import '../test_utils.dart';

void main() {
  setUp(() {
    GetIt.instance.reset();
  });

  testWidgets('Edit screen renders and pre-fills data', (WidgetTester tester) async {
    final mockClient = MockClient((request) async {
      if (request.url.path.contains('/rbac/roles/r1')) {
        return http.Response(jsonEncode({'role': {'id': 'r1', 'code': 'admin', 'name': 'Admin', 'description': 'Administrator', 'isSystem': true}}), 200);
      }
      if (request.url.path.contains('/effective-permissions')) {
        return http.Response(jsonEncode({'permissions': ['role.manage']}), 200);
      }
      return http.Response('{}', 200);
    });

    final apiClient = ApiClient(baseUrl: 'http://example.com', httpClient: mockClient);
    registerTestServices(apiClient: apiClient);

    final authz = GetIt.instance.get<AuthZService>();
    await authz.loadPermissions(apiClient, 'user-id');

    await tester.pumpWidget(TestApp(child: RoleEditScreen(roleId: 'r1')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 200));
    await tester.pumpAndSettle();

    expect(find.text('admin'), findsOneWidget);
    expect(find.text('Admin'), findsOneWidget);
    expect(find.text('Administrator'), findsOneWidget);
    expect(find.byType(Checkbox), findsOneWidget);
  });

  testWidgets('Permission denied hides edit form', (WidgetTester tester) async {
    final mockClient = MockClient((request) async {
      if (request.url.path.contains('/rbac/roles/r1')) {
        return http.Response(jsonEncode({'role': {'id': 'r1', 'code': 'admin', 'name': 'Admin'}}), 200);
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

    await tester.pumpWidget(TestApp(child: RoleEditScreen(roleId: 'r1')));
    await tester.pumpAndSettle();

    expect(find.text('You do not have permission to edit roles.'), findsOneWidget);
  });

  testWidgets('Successful update posts expected payload and shows success', (WidgetTester tester) async {
    late Map<String, dynamic> capturedBody;

    final mockClient = MockClient((request) async {
      if (request.method == 'GET' && request.url.path.contains('/rbac/roles/r1')) {
        return http.Response(jsonEncode({'role': {'id': 'r1', 'code': 'analyst', 'name': 'Analyst', 'description': 'Some description', 'isSystem': false}}), 200);
      }

      if (request.method == 'PATCH' && request.url.path.contains('/rbac/roles/r1')) {
        capturedBody = jsonDecode(request.body) as Map<String, dynamic>;
        return http.Response(jsonEncode({'role': {...capturedBody, 'id': 'r1'}}), 200);
      }

      if (request.url.path.contains('/effective-permissions')) {
        return http.Response(jsonEncode({'permissions': ['role.manage']}), 200);
      }

      return http.Response('{}', 200);
    });

    final apiClient = ApiClient(baseUrl: 'http://example.com', httpClient: mockClient);
    registerTestServices(apiClient: apiClient);

    final authz = GetIt.instance.get<AuthZService>();
    await authz.loadPermissions(apiClient, 'user-id');

    await tester.pumpWidget(TestApp(child: RoleEditScreen(roleId: 'r1')));
    await tester.pumpAndSettle();

    // change a field
    await tester.enterText(find.byType(TextFormField).at(0), 'analyst');
    await tester.enterText(find.byType(TextFormField).at(1), 'Analyst');
    await tester.enterText(find.byType(TextFormField).at(2), 'Some description');

    await tester.tap(find.text('Save'));
    await tester.pumpAndSettle();

    expect(capturedBody['code'], 'analyst');
    expect(capturedBody['name'], 'Analyst');
    expect(capturedBody['description'], 'Some description');

    expect(find.text('Role updated'), findsOneWidget);
  });

  testWidgets('Backend validation error displayed', (WidgetTester tester) async {
    final mockClient = MockClient((request) async {
      if (request.method == 'GET' && request.url.path.contains('/rbac/roles/r1')) {
        return http.Response(jsonEncode({'role': {'id': 'r1', 'code': 'bad', 'name': 'Bad'}}), 200);
      }
      if (request.method == 'PATCH' && request.url.path.contains('/rbac/roles/r1')) {
        return http.Response(jsonEncode({'message': 'Validation failed: code invalid'}), 400);
      }
      if (request.url.path.contains('/effective-permissions')) {
        return http.Response(jsonEncode({'permissions': ['role.manage']}), 200);
      }
      return http.Response('{}', 200);
    });

    final apiClient = ApiClient(baseUrl: 'http://example.com', httpClient: mockClient);
    registerTestServices(apiClient: apiClient);

    final authz = GetIt.instance.get<AuthZService>();
    await authz.loadPermissions(apiClient, 'user-id');

    await tester.pumpWidget(TestApp(child: RoleEditScreen(roleId: 'r1')));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextFormField).at(0), 'bad-code');
    await tester.enterText(find.byType(TextFormField).at(1), 'Bad');

    await tester.tap(find.text('Save'));
    await tester.pumpAndSettle();

    expect(find.textContaining('Validation failed'), findsOneWidget);
  });

  testWidgets('403 Forbidden handled gracefully', (WidgetTester tester) async {
    final mockClient = MockClient((request) async {
      if (request.method == 'GET' && request.url.path.contains('/rbac/roles/r1')) {
        return http.Response(jsonEncode({'role': {'id': 'r1', 'code': 'analyst', 'name': 'Analyst'}}), 200);
      }
      if (request.method == 'PATCH' && request.url.path.contains('/rbac/roles/r1')) {
        return http.Response('Forbidden', 403);
      }
      if (request.url.path.contains('/effective-permissions')) {
        return http.Response(jsonEncode({'permissions': ['role.manage']}), 200);
      }
      return http.Response('{}', 200);
    });

    final apiClient = ApiClient(baseUrl: 'http://example.com', httpClient: mockClient);
    registerTestServices(apiClient: apiClient);

    final authz = GetIt.instance.get<AuthZService>();
    await authz.loadPermissions(apiClient, 'user-id');

    await tester.pumpWidget(TestApp(child: RoleEditScreen(roleId: 'r1')));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextFormField).at(0), 'analyst');
    await tester.enterText(find.byType(TextFormField).at(1), 'Analyst');

    await tester.tap(find.text('Save'));
    await tester.pumpAndSettle();

    expect(find.textContaining('Forbidden'), findsOneWidget);
  });

  testWidgets('Server error handled gracefully', (WidgetTester tester) async {
    final mockClient = MockClient((request) async {
      if (request.method == 'GET' && request.url.path.contains('/rbac/roles/r1')) {
        return http.Response(jsonEncode({'role': {'id': 'r1', 'code': 'analyst', 'name': 'Analyst'}}), 200);
      }
      if (request.method == 'PATCH' && request.url.path.contains('/rbac/roles/r1')) {
        return http.Response('Internal Server Error', 500);
      }
      if (request.url.path.contains('/effective-permissions')) {
        return http.Response(jsonEncode({'permissions': ['role.manage']}), 200);
      }
      return http.Response('{}', 200);
    });

    final apiClient = ApiClient(baseUrl: 'http://example.com', httpClient: mockClient);
    registerTestServices(apiClient: apiClient);

    final authz = GetIt.instance.get<AuthZService>();
    await authz.loadPermissions(apiClient, 'user-id');

    await tester.pumpWidget(TestApp(child: RoleEditScreen(roleId: 'r1')));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextFormField).at(0), 'analyst');
    await tester.enterText(find.byType(TextFormField).at(1), 'Analyst');

    await tester.tap(find.text('Save'));
    await tester.pumpAndSettle();

    expect(find.textContaining('Failed to update role'), findsOneWidget);
  });
}
