import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'package:new_erp_final_frontend/core/auth/auth_service.dart';
import 'package:new_erp_final_frontend/core/network/api_client.dart';

class _MemorySecureStorage implements SecureStorageLike {
  final Map<String, String> values = {};

  @override
  Future<String?> read({required String key}) async => values[key];

  @override
  Future<void> write({required String key, required String value}) async {
    values[key] = value;
  }

  @override
  Future<void> delete({required String key}) async {
    values.remove(key);
  }
}

Map<String, dynamic> _loginResponse({
  String accessToken = 'access-token',
  String refreshToken = 'refresh-token',
  String tenantId = 'tenant-1',
}) => {
  'success': true,
  'accessToken': accessToken,
  'refreshToken': refreshToken,
  'expiresAt': DateTime.now().add(const Duration(hours: 1)).toIso8601String(),
  'contextType': 'tenant',
  'user': {'id': 'user-1', 'tenantId': tenantId},
  'session': {'tenantId': tenantId},
  'tenant': {'id': tenantId},
};

void main() {
  test('normal login stores the backend-established tenant session', () async {
    final storage = _MemorySecureStorage();
    final paths = <String>[];
    final client = MockClient((request) async {
      paths.add(request.url.path);
      if (request.url.path == '/api/v1/auth/login') {
        return http.Response(jsonEncode(_loginResponse()), 200);
      }
      if (request.url.path == '/api/v1/auth/modules') {
        return http.Response(jsonEncode({'modules': []}), 200);
      }
      if (request.url.path.contains('/effective-permissions')) {
        return http.Response(jsonEncode({'permissions': []}), 200);
      }
      return http.Response('ok', 200);
    });
    late final AuthService auth;
    auth = AuthService(
      secureStorage: storage,
      apiClientFactory: (baseUrl) =>
          ApiClient(baseUrl: baseUrl, httpClient: client, authOverride: auth),
    );

    expect(
      await auth.login('http://example.com', 'user@example.com', 'Password123'),
      isTrue,
    );
    expect(auth.isAuthenticated, isTrue);
    expect(auth.currentTenantId, 'tenant-1');
    expect(auth.nextPostAuthRoute, '/dashboard');
    expect(paths, isNot(contains('/api/v1/auth/organizations')));
    expect(storage.values, isNot(contains('discovery_token')));
  });

  test('multiple-tenant rejection fails closed without a chooser', () async {
    final client = MockClient((request) async {
      if (request.url.path == '/api/v1/auth/login') {
        return http.Response(
          jsonEncode({'message': 'Invalid credentials.'}),
          401,
        );
      }
      return http.Response('ok', 200);
    });
    late final AuthService auth;
    auth = AuthService(
      apiClientFactory: (baseUrl) =>
          ApiClient(baseUrl: baseUrl, httpClient: client),
    );

    expect(
      await auth.login('http://example.com', 'user@example.com', 'Password123'),
      isFalse,
    );
    expect(auth.isAuthenticated, isFalse);
    expect(auth.lastLoginError, 'Incorrect username or password.');
  });

  test('valid stored tenant session restores through /auth/me', () async {
    final storage = _MemorySecureStorage()
      ..values.addAll({
        'access_token': 'stored-access',
        'refresh_token': 'stored-refresh',
        'expires_at': DateTime.now()
            .add(const Duration(hours: 1))
            .toIso8601String(),
        'tenant_id': 'tenant-1',
        'context_type': 'tenant',
      });
    final client = MockClient((request) async {
      if (request.url.path == '/api/v1/auth/me') {
        return http.Response(
          jsonEncode({
            'success': true,
            'user': {'id': 'user-1', 'tenantId': 'tenant-1'},
          }),
          200,
        );
      }
      if (request.url.path == '/api/v1/auth/modules') {
        return http.Response(jsonEncode({'modules': []}), 200);
      }
      if (request.url.path.contains('/effective-permissions')) {
        return http.Response(jsonEncode({'permissions': []}), 200);
      }
      return http.Response('ok', 200);
    });
    late final AuthService auth;
    auth = AuthService(
      secureStorage: storage,
      apiClientFactory: (baseUrl) =>
          ApiClient(baseUrl: baseUrl, httpClient: client, authOverride: auth),
    );
    await auth.init();

    expect(await auth.restoreSession('http://example.com'), isTrue);
    expect(auth.currentTenantId, 'tenant-1');
    expect(auth.nextPostAuthRoute, '/dashboard');
  });

  test(
    'expired stored session clears credentials and returns to login',
    () async {
      final storage = _MemorySecureStorage()
        ..values.addAll({
          'access_token': 'expired-access',
          'refresh_token': 'expired-refresh',
          'expires_at': DateTime.now()
              .subtract(const Duration(minutes: 1))
              .toIso8601String(),
          'tenant_id': 'tenant-1',
          'context_type': 'tenant',
        });
      final client = MockClient((request) async {
        if (request.url.path == '/api/v1/auth/refresh') {
          return http.Response(
            jsonEncode({'message': 'Session is invalid or expired.'}),
            401,
          );
        }
        return http.Response('ok', 200);
      });
      late final AuthService auth;
      auth = AuthService(
        secureStorage: storage,
        apiClientFactory: (baseUrl) =>
            ApiClient(baseUrl: baseUrl, httpClient: client, authOverride: auth),
      );
      await auth.init();

      expect(await auth.restoreSession('http://example.com'), isFalse);
      expect(auth.isAuthenticated, isFalse);
      expect(auth.nextPostAuthRoute, '/login');
      expect(storage.values, isEmpty);
    },
  );

  test(
    'refresh preserves the authenticated tenant and logout clears it',
    () async {
      final storage = _MemorySecureStorage();
      final client = MockClient((request) async {
        if (request.url.path == '/api/v1/auth/login') {
          return http.Response(jsonEncode(_loginResponse()), 200);
        }
        if (request.url.path == '/api/v1/auth/refresh') {
          return http.Response(
            jsonEncode({
              'success': true,
              'accessToken': 'refreshed-access',
              'expiresAt': DateTime.now()
                  .add(const Duration(hours: 1))
                  .toIso8601String(),
              'tokenType': 'bearer',
            }),
            200,
          );
        }
        if (request.url.path == '/api/v1/auth/logout') {
          return http.Response('ok', 200);
        }
        if (request.url.path == '/api/v1/auth/modules') {
          return http.Response(jsonEncode({'modules': []}), 200);
        }
        if (request.url.path.contains('/effective-permissions')) {
          return http.Response(jsonEncode({'permissions': []}), 200);
        }
        return http.Response('ok', 200);
      });
      late final AuthService auth;
      auth = AuthService(
        secureStorage: storage,
        apiClientFactory: (baseUrl) =>
            ApiClient(baseUrl: baseUrl, httpClient: client, authOverride: auth),
      );
      await auth.login('http://example.com', 'user@example.com', 'Password123');

      expect(await auth.tryRefresh(), isTrue);
      expect(auth.currentTenantId, 'tenant-1');
      await auth.logout();
      expect(auth.isAuthenticated, isFalse);
      expect(auth.currentTenantId, isNull);
      expect(storage.values, isEmpty);
    },
  );
}
