import 'dart:async';
import 'dart:convert';

import 'package:get_it/get_it.dart';
import 'package:http/http.dart' as http;

import '../auth/auth_service.dart';

class ApiClient {
  final String baseUrl;
  final Duration timeout;
  final http.Client _client;
  final AuthService? authOverride;

  ApiClient({
    this.baseUrl = '',
    this.timeout = const Duration(seconds: 15),
    this.authOverride,
    http.Client? httpClient,
    http.Client? client,
  }) : _client = httpClient ?? client ?? http.Client();

  AuthService get _auth {
    if (authOverride != null) return authOverride!;
    try {
      if (GetIt.instance.isRegistered<AuthService>()) {
        return GetIt.instance.get<AuthService>();
      }
    } catch (_) {
      // The global container may not be initialized during isolated tests.
    }
    return AuthService();
  }

  Future<http.Response> _sendWithAuth(
    Future<http.Response> Function(Map<String, String> headers) fn,
  ) async {
    final auth = _auth;
    final headers = <String, String>{'Content-Type': 'application/json'};

    final accessToken = auth.accessToken;
    if (accessToken != null) {
      headers['Authorization'] = ['Bearer', accessToken].join(' ');
    }
    http.Response response = await fn(headers).timeout(timeout);

    // The refresh endpoint must never recursively trigger another refresh.
    // A failed/stale refresh token otherwise causes an endless POST /auth/refresh
    // loop in the browser when restoring an old session.
    final canRefresh = response.statusCode == 401 &&
        !_isRefreshEndpoint(Uri.parse('${baseUrl.isEmpty ? '' : baseUrl}${path}').path);

    if (canRefresh) {
      final refreshed = await auth.tryRefresh();
      if (refreshed) {
        final newToken = auth.accessToken;
        if (newToken != null) {
          headers['Authorization'] = ['Bearer', newToken].join(' ');
          response = await fn(headers).timeout(timeout);
        }
      }
    }
    return response;
  }

  bool _isRefreshEndpoint(String path) =>
      path == '/api/v1/auth/refresh' || path.endsWith('/api/v1/auth/refresh');

  Future<http.Response> post(String path, {Map<String, dynamic>? body}) async {
    final url = Uri.parse('$baseUrl$path');
    return _sendWithAuth(
      (headers) =>
          _client.post(url, headers: headers, body: jsonEncode(body ?? {})),
    );
  }

  Future<http.Response> get(String path) async {
    final url = Uri.parse('$baseUrl$path');
    return _sendWithAuth((headers) => _client.get(url, headers: headers));
  }

  Future<http.Response> put(String path, {Map<String, dynamic>? body}) async {
    final url = Uri.parse('$baseUrl$path');
    return _sendWithAuth(
      (headers) =>
          _client.put(url, headers: headers, body: jsonEncode(body ?? {})),
    );
  }

  Future<http.Response> patch(String path, {Map<String, dynamic>? body}) async {
    final url = Uri.parse('$baseUrl$path');
    return _sendWithAuth(
      (headers) =>
          _client.patch(url, headers: headers, body: jsonEncode(body ?? {})),
    );
  }

  Future<http.Response> delete(
    String path, {
    Map<String, dynamic>? body,
  }) async {
    final url = Uri.parse('$baseUrl$path');
    return _sendWithAuth(
      (headers) =>
          _client.delete(url, headers: headers, body: jsonEncode(body ?? {})),
    );
  }
}
