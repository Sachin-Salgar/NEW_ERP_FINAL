import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'package:new_erp_final_frontend/core/network/api_client.dart';
import 'package:new_erp_final_frontend/core/auth/authz_service.dart';
import 'package:new_erp_final_frontend/modules/role/create_screen.dart';

import '../test_utils.dart';

void main() {
  setUp(() {
    GetIt.instance.reset();
  });

  testWidgets('Create form renders with required fields and submit button', (WidgetTester tester) async {
    final mockClient = MockClient((request) async {
      // Allow permission fetch if requested
      if (request.url.path.contains('/effective-permissions')) {
        return http.Response(jsonEncode({'permissions': ['role.manage']}), 200);
      }
      return http.Response('{}', 200);
    });

    final apiClient = ApiClient(baseUrl: 'http://example.com', httpClient: mockClient);
    registerTestServices(apiClient: apiClient);

    // Give user the role.manage permission so form is accessible
    final authz = GetIt.instance.get<AuthZService>();
    await authz.loadPermissions(apiClient, 'user-id');

    await tester.pumpWidget(TestApp(child: const RoleCreateScreen()));
    await tester.pumpAndSettle();

    expect(find.byType(TextFormField), findsNWidgets(3));
    expect(find.text('Create'), findsOneWidget);
  });

  testWidgets('Permission denied hides create form', (WidgetTester tester) async {
    final mockClient = MockClient((request) async {
      if (request.url.path.contains('/effective-permissions')) {
        return http.Response(jsonEncode({'permissions': []}), 200);
      }
      return http.Response('{}', 200);
    });

    final apiClient = ApiClient(baseUrl: 'http://example.com', httpClient: mockClient);
    registerTestServices(apiClient: apiClient);

    // No role.manage permission
    final authz = GetIt.instance.get<AuthZService>();
    await authz.loadPermissions(apiClient, 'user-id');

    await tester.pumpWidget(TestApp(child: const RoleCreateScreen()));
    await tester.pumpAndSettle();

    expect(find.text('You do not have permission to create roles.'), findsOneWidget);
  });

  testWidgets('Successful creation posts expected payload and shows success', (WidgetTester tester) async {
    late Map<String, dynamic> capturedBody;

    final mockClient = MockClient((request) async {
      if (request.method == 'POST' && request.url.path.contains('/rbac/roles')) {
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

    await tester.pumpWidget(TestApp(child: const RoleCreateScreen()));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextFormField).at(0), 'analyst');
    await tester.enterText(find.byType(TextFormField).at(1), 'Analyst');
    await tester.enterText(find.byType(TextFormField).at(2), 'Some description');

    await tester.tap(find.text('Create'));
    await tester.pumpAndSettle();

    expect(capturedBody['code'], 'analyst');
    expect(capturedBody['name'], 'Analyst');
    expect(capturedBody['description'], 'Some description');

    // Success SnackBar shown
    expect(find.text('Role created'), findsOneWidget);
  });

  testWidgets('Client-side validation prevents empty submit', (WidgetTester tester) async {
    final mockClient = MockClient((request) async {
      if (request.url.path.contains('/effective-permissions')) {
        return http.Response(jsonEncode({'permissions': ['role.manage']}), 200);
      }
      return http.Response('{}', 200);
    });

    final apiClient = ApiClient(baseUrl: 'http://example.com', httpClient: mockClient);
    registerTestServices(apiClient: apiClient);

    final authz = GetIt.instance.get<AuthZService>();
    await authz.loadPermissions(apiClient, 'user-id');

    await tester.pumpWidget(TestApp(child: const RoleCreateScreen()));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Create'));
    await tester.pumpAndSettle();

    expect(find.text('Role code is required.'), findsOneWidget);
    expect(find.text('Role name is required.'), findsOneWidget);
  });

  testWidgets('Backend validation error displayed', (WidgetTester tester) async {
    final mockClient = MockClient((request) async {
      if (request.method == 'POST' && request.url.path.contains('/rbac/roles')) {
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

    await tester.pumpWidget(TestApp(child: const RoleCreateScreen()));
    await tester.pumpAndSettle();

    // Provide valid values to reach server
    await tester.enterText(find.byType(TextFormField).at(0), 'bad-code');
    await tester.enterText(find.byType(TextFormField).at(1), 'Bad');

    await tester.tap(find.text('Create'));
    await tester.pumpAndSettle();

    expect(find.textContaining('Validation failed'), findsOneWidget);
  });

  testWidgets('403 Forbidden handled gracefully', (WidgetTester tester) async {
    final mockClient = MockClient((request) async {
      if (request.method == 'POST' && request.url.path.contains('/rbac/roles')) {
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

    await tester.pumpWidget(TestApp(child: const RoleCreateScreen()));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextFormField).at(0), 'analyst');
    await tester.enterText(find.byType(TextFormField).at(1), 'Analyst');

    await tester.tap(find.text('Create'));
    await tester.pumpAndSettle();

    expect(find.textContaining('Forbidden'), findsOneWidget);
  });

  testWidgets('Server error handled gracefully', (WidgetTester tester) async {
    final mockClient = MockClient((request) async {
      if (request.method == 'POST' && request.url.path.contains('/rbac/roles')) {
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

    await tester.pumpWidget(TestApp(child: const RoleCreateScreen()));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextFormField).at(0), 'analyst');
    await tester.enterText(find.byType(TextFormField).at(1), 'Analyst');

    await tester.tap(find.text('Create'));
    await tester.pumpAndSettle();

    expect(find.textContaining('Failed to create role'), findsOneWidget);
  });
}
