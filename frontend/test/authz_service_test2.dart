import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:http/testing.dart';
import 'package:http/http.dart' as http;

import 'package:new_erp_final_frontend/core/auth/authz_service.dart';
import 'package:new_erp_final_frontend/core/network/api_client.dart';
import 'package:new_erp_final_frontend/core/auth/auth_service.dart';

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

  group('AuthZService (new)', () {
    test('loads permissions successfully and reports hasPermission/hasAny', () async {
      final client = MockClient((request) async {
        if (request.url.path.contains('effective-permissions')) {
          return http.Response(jsonEncode({
            'success': true,
            'userId': 'user-1',
            'permissions': ['perm.a', 'perm.b']
          }), 200);
        }
        return http.Response('not found', 404);
      });

      final authStub = AuthService(secureStorage: _MemorySecureStorage(), apiClientFactory: (baseUrl) => ApiClient(baseUrl: baseUrl, httpClient: client));
      GetIt.instance.registerSingleton<AuthService>(authStub);
      final api = ApiClient(baseUrl: 'http://example.com', httpClient: client);
      final svc = AuthZService();

      final perms = await svc.loadPermissions(api, 'user-1');
      expect(perms, contains('perm.a'));
      expect(svc.hasPermission('perm.a'), isTrue);
      expect(svc.hasPermission('perm.x'), isFalse);
      expect(svc.hasAnyPermission(['perm.x', 'perm.b']), isTrue);
    });

    test('refresh replaces old permission set', () async {
      var stage = 0;
      final client = MockClient((request) async {
        if (request.url.path.contains('effective-permissions')) {
          if (stage == 0) {
            return http.Response(jsonEncode({
              'success': true,
              'userId': 'user-1',
              'permissions': ['p1']
            }), 200);
          } else {
            return http.Response(jsonEncode({
              'success': true,
              'userId': 'user-1',
              'permissions': ['p2']
            }), 200);
          }
        }
        return http.Response('not found', 404);
      });

      final authStub = AuthService(secureStorage: _MemorySecureStorage(), apiClientFactory: (baseUrl) => ApiClient(baseUrl: baseUrl, httpClient: client));
      GetIt.instance.registerSingleton<AuthService>(authStub);
      final api = ApiClient(baseUrl: 'http://example.com', httpClient: client);
      final svc = AuthZService();

      final first = await svc.loadPermissions(api, 'user-1');
      expect(first, contains('p1'));
      stage = 1;
      final refreshed = await svc.refresh(api);
      expect(refreshed, contains('p2'));
      expect(svc.hasPermission('p1'), isFalse);
      expect(svc.hasPermission('p2'), isTrue);
    });

    test('coalesces concurrent permission loads for the same user', () async {
      var calls = 0;
      final client = MockClient((request) async {
        if (request.url.path.contains('effective-permissions')) {
          calls += 1;
          await Future<void>.delayed(const Duration(milliseconds: 50));
          return http.Response(jsonEncode({
            'success': true,
            'userId': 'user-1',
            'permissions': ['perm.a']
          }), 200);
        }
        return http.Response('not found', 404);
      });

      final authStub = AuthService(secureStorage: _MemorySecureStorage(), apiClientFactory: (baseUrl) => ApiClient(baseUrl: baseUrl, httpClient: client));
      GetIt.instance.registerSingleton<AuthService>(authStub);
      final api = ApiClient(baseUrl: 'http://example.com', httpClient: client);
      final svc = AuthZService();

      final first = svc.loadPermissions(api, 'user-1');
      final second = svc.loadPermissions(api, 'user-1');
      final results = await Future.wait([first, second]);

      expect(calls, 1);
      expect(results[0], contains('perm.a'));
      expect(svc.hasPermission('perm.a'), isTrue);
    });

    test('clear removes permissions and does not grant access', () async {
      final client = MockClient((request) async {
        if (request.url.path.contains('effective-permissions')) {
          return http.Response(jsonEncode({
            'success': true,
            'userId': 'user-1',
            'permissions': ['perm.a']
          }), 200);
        }
        return http.Response('not found', 404);
      });

      final authStub = AuthService(secureStorage: _MemorySecureStorage(), apiClientFactory: (baseUrl) => ApiClient(baseUrl: baseUrl, httpClient: client));
      GetIt.instance.registerSingleton<AuthService>(authStub);
      final api = ApiClient(baseUrl: 'http://example.com', httpClient: client);
      final svc = AuthZService();

      await svc.loadPermissions(api, 'user-1');
      expect(svc.hasPermission('perm.a'), isTrue);
      svc.clear();
      expect(svc.hasPermission('perm.a'), isFalse);
      expect(svc.getPermissionKeys(), isEmpty);
    });

    test('failed permission load does not grant permissions', () async {
      final client = MockClient((request) async {
        return http.Response('server error', 500);
      });

      final authStub = AuthService(secureStorage: _MemorySecureStorage(), apiClientFactory: (baseUrl) => ApiClient(baseUrl: baseUrl, httpClient: client));
      GetIt.instance.registerSingleton<AuthService>(authStub);
      final api = ApiClient(baseUrl: 'http://example.com', httpClient: client);
      final svc = AuthZService();

      final perms = await svc.loadPermissions(api, 'user-1');
      expect(perms, isEmpty);
      expect(svc.hasPermission('anything'), isFalse);
    });

    test('permission state is isolated between users', () async {
      final client = MockClient((request) async {
        if (request.url.path.contains('user-1')) {
          return http.Response(jsonEncode({
            'success': true,
            'userId': 'user-1',
            'permissions': ['p1']
          }), 200);
        }
        if (request.url.path.contains('user-2')) {
          return http.Response(jsonEncode({
            'success': true,
            'userId': 'user-2',
            'permissions': ['p2']
          }), 200);
        }
        return http.Response('not found', 404);
      });

      final authStub = AuthService(secureStorage: _MemorySecureStorage(), apiClientFactory: (baseUrl) => ApiClient(baseUrl: baseUrl, httpClient: client));
      GetIt.instance.registerSingleton<AuthService>(authStub);
      final api = ApiClient(baseUrl: 'http://example.com', httpClient: client);
      final svc = AuthZService();

      await svc.loadPermissions(api, 'user-1');
      expect(svc.hasPermission('p1'), isTrue);
      expect(svc.hasPermission('p2'), isFalse);

      await svc.loadPermissions(api, 'user-2');
      expect(svc.hasPermission('p2'), isTrue);
      expect(svc.hasPermission('p1'), isFalse);
    });
  });
}
