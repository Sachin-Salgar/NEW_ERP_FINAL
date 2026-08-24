import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'package:new_erp_final_frontend/core/auth/auth_service.dart';
import 'package:new_erp_final_frontend/core/auth/authz_service.dart';
import 'package:new_erp_final_frontend/core/network/api_client.dart';
import 'package:new_erp_final_frontend/modules/user/user_service.dart';
import 'package:new_erp_final_frontend/presentation/ui/components/navigation_sidebar.dart';
import 'package:new_erp_final_frontend/routing/router.dart';

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

Future<AuthService> _setupAuthenticatedAuth({
  List<String> permissions = const [],
}) async {
  final mockClient = MockClient((request) async {
    if (request.url.path == '/api/v1/bootstrap') {
      return http.Response(
        jsonEncode({
          'deployment': {'tenantId': 'tenant-1'},
        }),
        200,
      );
    }
    if (request.url.path == '/api/v1/auth/login') {
      return http.Response(
        jsonEncode({
          'accessToken': 'test-access-token',
          'refreshToken': 'refresh-token',
          'expiresAt': DateTime.now()
              .add(const Duration(hours: 1))
              .toIso8601String(),
          'user': {
            'id': 'user-1',
            'tenantId': 'tenant-1',
            'username': 'demo-user',
          },
          'session': {'tenantId': 'tenant-1'},
        }),
        200,
      );
    }
    if (request.url.path == '/api/v1/users') {
      return http.Response(jsonEncode({'users': []}), 200);
    }
    if (request.url.path.contains('/effective-permissions')) {
      return http.Response(jsonEncode({'permissions': permissions}), 200);
    }
    return http.Response('{}', 200);
  });

  final storage = _MemorySecureStorage();
  final api = ApiClient(baseUrl: 'http://example.com', httpClient: mockClient);
  final auth = AuthService(
    secureStorage: storage,
    apiClientFactory: (baseUrl) => api,
  );

  GetIt.instance.registerSingleton<ApiClient>(api);
  GetIt.instance.registerSingleton<AuthZService>(auth.authzService);
  GetIt.instance.registerSingleton<AuthService>(auth);

  final loginOk = await auth.login(
    'http://example.com',
    'demo-user',
    'Password123',
  );
  expect(loginOk, isTrue);

  await auth.authzService.loadPermissions(api, 'user-1');

  return auth;
}

void main() {
  setUp(() {
    GetIt.instance.reset();
  });

  tearDown(() {
    GetIt.instance.reset();
  });

  testWidgets('Protected routes deny access without permission', (
    tester,
  ) async {
    await _setupAuthenticatedAuth(permissions: []);
    GetIt.instance.registerSingleton<UserService>(
      UserService(apiClient: GetIt.instance.get<ApiClient>()),
    );

    await tester.pumpWidget(
      MaterialApp(
        onGenerateRoute: AppRouter.generateRoute,
        initialRoute: '/users',
      ),
    );
    await tester.pumpAndSettle();

    expect(find.textContaining('Required permission: user.read'), findsOneWidget);
    expect(find.text('Access denied'), findsOneWidget);
  });

  testWidgets('Protected routes allow access when permission exists', (
    tester,
  ) async {
    await _setupAuthenticatedAuth(permissions: ['user.read']);
    GetIt.instance.registerSingleton<UserService>(
      UserService(apiClient: GetIt.instance.get<ApiClient>()),
    );

    await tester.pumpWidget(
      MaterialApp(
        onGenerateRoute: AppRouter.generateRoute,
        initialRoute: '/users',
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Users'), findsWidgets);
    expect(find.text('No users found'), findsOneWidget);
  });

  testWidgets('Sidebar hides protected menu items without permission', (
    tester,
  ) async {
    await _setupAuthenticatedAuth(permissions: ['user.read']);

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: Sidebar(selectedRoute: '/dashboard')),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Users'), findsOneWidget);
    expect(find.text('Roles'), findsNothing);
    expect(find.text('Permissions'), findsNothing);
  });
}
