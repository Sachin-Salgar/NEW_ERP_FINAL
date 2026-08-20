import 'dart:convert';
import 'dart:async';

import 'package:http/http.dart' as http;
import 'package:get_it/get_it.dart';

import '../auth/auth_service.dart';

class ApiClient {
  final String baseUrl;
  final Duration timeout;
  final String tenantHeaderName;

  ApiClient({
    required this.baseUrl,
    this.timeout = const Duration(seconds: 15),
    this.tenantHeaderName = 'x-tenant-id',
  });

  Future<http.Response> _sendWithAuth(Future<http.Response> Function(Map<String, String> headers) fn) async {
    final auth = GetIt.instance.get<AuthService>();
    final headers = <String, String>{
      'Content-Type': 'application/json',
    };

    final tenantId = auth.currentTenantId;
    if (tenantId != null) {
      headers[tenantHeaderName] = tenantId;
    }

    final accessToken = auth.accessToken;
    if (accessToken != null) {
      headers['Authorization'] = 'Bearer $accessToken';
    }

    http.Response resp = await fn(headers).timeout(timeout);

    if (resp.statusCode == 401) {
      // Try refresh once
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
    return _sendWithAuth((headers) => http.post(url, headers: headers, body: jsonEncode(body ?? {})));
  }

  Future<http.Response> get(String path) async {
    final url = Uri.parse('$baseUrl$path');
    return _sendWithAuth((headers) => http.get(url, headers: headers));
  }

  Future<http.Response> put(String path, {Map<String, dynamic>? body}) async {
    final url = Uri.parse('$baseUrl$path');
    return _sendWithAuth((headers) => http.put(url, headers: headers, body: jsonEncode(body ?? {})));
  }

  Future<http.Response> delete(String path) async {
    final url = Uri.parse('$baseUrl$path');
    return _sendWithAuth((headers) => http.delete(url, headers: headers));
  }
}
