import 'dart:convert';
import 'dart:async';

import 'package:http/http.dart' as http;
import 'package:get_it/get_it.dart';

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
    if (authOverride != null) {
      return authOverride!;
    }

    try {
      if (GetIt.instance.isRegistered<AuthService>()) {
        return GetIt.instance.get<AuthService>();
      }
    } catch (_) {
      // Fall back to a minimal auth instance when the global container has not been initialized.
    }

    return AuthService();
  }

  Future<http.Response> _sendWithAuth(Future<http.Response> Function(Map<String, String> headers) fn) async {
    final auth = _auth;
    final headers = <String, String>{
      'Content-Type': 'application/json',
    };

    final accessToken = auth.accessToken;
    if (accessToken != null) {
      headers['Authorization'] = 'Bearer $accessToken';
    }

    http.Response resp = await fn(headers).timeout(timeout);

    if (resp.statusCode == 401) {
      final refreshed = await auth.tryRefresh();
      if (refreshed) {
        final newToken = auth.accessToken;
        if (newToken != null) {
          headers['Authorization'] = 'Bearer $newToken';
          resp = await fn(headers).timeout(timeout);
        }
      }
    }

    return resp;
  }

  Future<http.Response> post(String path, {Map<String, dynamic>? body}) async {
    final url = Uri.parse('$baseUrl$path');
    return _sendWithAuth((headers) => _client.post(url, headers: headers, body: jsonEncode(body ?? {})));
  }

  Future<http.Response> get(String path) async {
    final url = Uri.parse('$baseUrl$path');
    return _sendWithAuth((headers) => _client.get(url, headers: headers));
  }

  Future<http.Response> put(String path, {Map<String, dynamic>? body}) async {
    final url = Uri.parse('$baseUrl$path');
    return _sendWithAuth((headers) => _client.put(url, headers: headers, body: jsonEncode(body ?? {})));
  }

  Future<http.Response> patch(String path, {Map<String, dynamic>? body}) async {
    final url = Uri.parse('$baseUrl$path');
    return _sendWithAuth((headers) => _client.patch(url, headers: headers, body: jsonEncode(body ?? {})));
  }

  Future<http.Response> delete(String path, {Map<String, dynamic>? body}) async {
    final url = Uri.parse('$baseUrl$path');
    return _sendWithAuth((headers) => _client.delete(url, headers: headers, body: jsonEncode(body ?? {})));
  }
}
