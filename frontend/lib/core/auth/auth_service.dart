import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

class AuthService extends ChangeNotifier {
  final FlutterSecureStorage _secureStorage = const FlutterSecureStorage();
  String? _accessToken;
  String? _refreshToken;
  DateTime? _expiresAt;
  String? currentTenantId;
  Map<String, dynamic>? currentUser;

  bool get isAuthenticated => _accessToken != null && _expiresAt != null && DateTime.now().isBefore(_expiresAt!);
  String? get accessToken => _accessToken;

  Future<void> init() async {
    // Restore tokens from secure storage
    _accessToken = await _secureStorage.read(key: 'access_token');
    _refreshToken = await _secureStorage.read(key: 'refresh_token');
    final exp = await _secureStorage.read(key: 'expires_at');
    currentTenantId = await _secureStorage.read(key: 'tenant_id');
    if (exp != null) {
      _expiresAt = DateTime.tryParse(exp);
    }

    if (_accessToken != null && _refreshToken != null) {
      // Optionally validate with /auth/me later
      notifyListeners();
    }
  }

  Future<bool> login(String baseUrl, String tenantId, String identifier, String password) async {
    final url = Uri.parse('$baseUrl/api/v1/auth/login');
    final resp = await http.post(url, headers: {'Content-Type': 'application/json', 'x-tenant-id': tenantId}, body: jsonEncode({'identifier': identifier, 'password': password}));

    if (resp.statusCode == 200) {
      final body = jsonDecode(resp.body) as Map<String, dynamic>;
      _accessToken = body['accessToken'] as String?;
      _refreshToken = body['refreshToken'] as String?;
      _expiresAt = DateTime.tryParse(body['expiresAt'] as String? ?? '');
      currentUser = body['user'] as Map<String, dynamic>?;
      currentTenantId = tenantId;

      await _secureStorage.write(key: 'access_token', value: _accessToken);
      await _secureStorage.write(key: 'refresh_token', value: _refreshToken);
      if (_expiresAt != null) await _secureStorage.write(key: 'expires_at', value: _expiresAt!.toIso8601String());
      await _secureStorage.write(key: 'tenant_id', value: tenantId);

      notifyListeners();
      return true;
    }

    return false;
  }

  Future<bool> tryRefresh() async {
    if (_refreshToken == null) return false;
    try {
      final url = Uri.parse('${_determineBaseUrl()}/api/v1/auth/refresh');
      final resp = await http.post(url, headers: {'Content-Type': 'application/json'}, body: jsonEncode({'refreshToken': _refreshToken}));
      if (resp.statusCode == 200) {
        final body = jsonDecode(resp.body) as Map<String, dynamic>;
        _accessToken = body['accessToken'] as String?;
        _expiresAt = DateTime.tryParse(body['expiresAt'] as String? ?? '');
        if (_accessToken != null) await _secureStorage.write(key: 'access_token', value: _accessToken);
        if (_expiresAt != null) await _secureStorage.write(key: 'expires_at', value: _expiresAt!.toIso8601String());
        notifyListeners();
        return true;
      }
    } catch (e) {
      // ignore
    }
    return false;
  }

  Future<void> logout() async {
    // Attempt server logout if possible
    try {
      if (_accessToken != null) {
        final url = Uri.parse('${_determineBaseUrl()}/api/v1/auth/logout');
        await http.post(url, headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer $_accessToken'});
      }
    } catch (e) {
      // ignore
    }

    _accessToken = null;
    _refreshToken = null;
    _expiresAt = null;
    currentUser = null;
    currentTenantId = null;

    await _secureStorage.delete(key: 'access_token');
    await _secureStorage.delete(key: 'refresh_token');
    await _secureStorage.delete(key: 'expires_at');
    await _secureStorage.delete(key: 'tenant_id');

    notifyListeners();
  }

  Future<bool> loadMe(String baseUrl) async {
    if (_accessToken == null) return false;
    try {
      final url = Uri.parse('$baseUrl/api/v1/auth/me');
      final resp = await http.get(url, headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer $_accessToken'});
      if (resp.statusCode == 200) {
        final body = jsonDecode(resp.body) as Map<String, dynamic>;
        currentUser = body['user'] as Map<String, dynamic>?;
        notifyListeners();
        return true;
      }
    } catch (e) {
      // ignore
    }
    return false;
  }

  String _determineBaseUrl() {
    // Default to localhost; the actual baseUrl should be provided by environment/config in production
    return const String.fromEnvironment('API_BASE_URL', defaultValue: 'http://localhost:3001');
  }
}
