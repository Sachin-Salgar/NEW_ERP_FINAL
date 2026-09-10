import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'authz_service.dart';
import '../network/api_client.dart';

abstract class SecureStorageLike {
  Future<String?> read({required String key});
  Future<void> write({required String key, required String value});
  Future<void> delete({required String key});
}

class FlutterSecureStorageAdapter implements SecureStorageLike {
  final FlutterSecureStorage _inner = FlutterSecureStorage();
  @override
  Future<String?> read({required String key}) => _inner.read(key: key);
  @override
  Future<void> write({required String key, required String value}) =>
      _inner.write(key: key, value: value);
  @override
  Future<void> delete({required String key}) => _inner.delete(key: key);
}

class PendingLoginContext {
  final String type;
  final String contextRef;
  final String label;

  const PendingLoginContext({
    required this.type,
    required this.contextRef,
    required this.label,
  });
}

class AuthService extends ChangeNotifier {
  final AuthZService authzService;
  final SecureStorageLike _secureStorage;
  final ApiClient Function(String baseUrl) _apiClientFactory;
  late ApiClient _apiClient;
  AuthService({
    SecureStorageLike? secureStorage,
    ApiClient Function(String baseUrl)? apiClientFactory,
    AuthZService? authzService,
  }) : _secureStorage = secureStorage ?? FlutterSecureStorageAdapter(),
       _apiClientFactory =
           apiClientFactory ?? ((baseUrl) => ApiClient(baseUrl: baseUrl)),
       authzService = authzService ?? AuthZService();

  String? _accessToken, _refreshToken;
  DateTime? _expiresAt;
  Future<bool>? _refreshRequest;
  String? currentTenantId, currentBranchId;
  Map<String, dynamic>? currentUser, deploymentInfo;
  String? contextType;
  String? _postAuthRoute;
  String? _pendingSelectionToken;
  List<PendingLoginContext> _pendingContexts = const [];
  Future<bool>? _selectionRequest;
  List<Map<String, dynamic>> availableModules = const [];
  bool _accessibleModulesLoaded = false;
  String? lastLoginError;
  bool get isAuthenticated =>
      _accessToken != null &&
      _expiresAt != null &&
      DateTime.now().isBefore(_expiresAt!);
  String? get accessToken => _accessToken;
  bool get hasPendingSelection =>
      !isAuthenticated &&
      _pendingSelectionToken != null &&
      _pendingContexts.isNotEmpty;
  List<PendingLoginContext> get pendingContexts => _pendingContexts;
  String get nextPostAuthRoute => !isAuthenticated
      ? '/login'
      : _postAuthRoute ??
            (contextType == 'platform' ? '/platform' : '/dashboard');
  Future<void> ensureEffectivePermissionsLoaded({String? baseUrl}) async {
    if (!isAuthenticated || currentUser == null || currentUser!['id'] == null)
      return;
    final userId = currentUser!['id'].toString();
    final targetBaseUrl = baseUrl ?? _currentBaseUrl;
    _ensureApiClient(targetBaseUrl);
    if (authzService.isLoaded && authzService.loadedForUserId == userId) {
      return;
    }
    if (authzService.isLoading && authzService.loadedForUserId == userId) {
      return;
    }
    await authzService.loadPermissions(_apiClient, userId);
  }

  void _ensureApiClient(String baseUrl) =>
      _apiClient = _apiClientFactory(baseUrl);

  Future<void> init() async {
    _accessToken = await _secureStorage.read(key: 'access_token');
    _refreshToken = await _secureStorage.read(key: 'refresh_token');
    final exp = await _secureStorage.read(key: 'expires_at');
    if (exp != null) _expiresAt = DateTime.tryParse(exp);
    currentTenantId = await _secureStorage.read(key: 'tenant_id');
    contextType = await _secureStorage.read(key: 'context_type');
    currentBranchId = await _secureStorage.read(key: 'branch_id');
    if (_accessToken != null) notifyListeners();
  }

  Future<Map<String, dynamic>?> bootstrap(String baseUrl) async {
    _ensureApiClient(baseUrl);
    try {
      final r = await _apiClient.get('/api/v1/bootstrap');
      if (r.statusCode != 200) return null;
      final b = jsonDecode(r.body) as Map<String, dynamic>;
      deploymentInfo = (b['deployment'] as Map<String, dynamic>?) ?? {};
      notifyListeners();
      return b;
    } catch (_) {
      return null;
    }
  }

  Future<bool> login(String baseUrl, String identifier, String password) async {
    _ensureApiClient(baseUrl);
    lastLoginError = null;
    try {
      final r = await _apiClient.post(
        '/api/v1/auth/login',
        body: {'identifier': identifier, 'password': password},
      );
      if (r.statusCode != 200) {
        lastLoginError = _loginErrorFromResponse(r.statusCode, r.body);
        if (kDebugMode)
          debugPrint(
            'ERP login failed: HTTP ${r.statusCode}; ${lastLoginError ?? 'no response message'}',
          );
        return false;
      }
      final body = jsonDecode(r.body) as Map<String, dynamic>;
      if (body['resolution'] == 'SELECT') {
        final token = body['pendingSelectionToken'];
        final contexts = body['contexts'];
        if (token is! String || token.isEmpty || contexts is! List) {
          lastLoginError = 'Login could not be completed. Please try again.';
          return false;
        }
        final safeContexts = contexts
            .whereType<Map>()
            .map((context) {
              final type = context['type'];
              final contextRef = context['contextRef'];
              final label = context['label'];
              if (type is! String ||
                  contextRef is! String ||
                  label is! String ||
                  type.isEmpty ||
                  contextRef.isEmpty ||
                  label.trim().isEmpty) {
                return null;
              }
              return PendingLoginContext(
                type: type,
                contextRef: contextRef,
                label: label.trim(),
              );
            })
            .whereType<PendingLoginContext>()
            .toList(growable: false);
        if (safeContexts.isEmpty) {
          lastLoginError = 'Login could not be completed. Please try again.';
          return false;
        }
        _clearLocalSession();
        _pendingSelectionToken = token;
        _pendingContexts = safeContexts;
        lastLoginError = null;
        notifyListeners();
        return false;
      }
      if (!await _storeSession(body)) {
        lastLoginError = 'Login could not be completed. Please try again.';
        return false;
      }
      await loadAccessibleModules(baseUrl);
      await fetchEffectivePermissions(baseUrl);
      notifyListeners();
      return true;
    } on TimeoutException {
      lastLoginError = 'Unable to reach the ERP server (request timed out).';
      if (kDebugMode) debugPrint('ERP login failed: request timed out.');
      return false;
    } catch (e) {
      lastLoginError = 'Unable to reach the ERP server. Check the API connection and try again.';
      if (kDebugMode) debugPrint('ERP login failed: $e');
      return false;
    }
  }

  Future<bool> selectContext(String baseUrl, String contextRef) async {
    if (!hasPendingSelection || _selectionRequest != null) return false;
    final token = _pendingSelectionToken!;
    final request = _completeContextSelection(baseUrl, token, contextRef);
    _selectionRequest = request;
    try {
      return await request;
    } finally {
      _selectionRequest = null;
    }
  }

  Future<bool> _completeContextSelection(
    String baseUrl,
    String token,
    String contextRef,
  ) async {
    _ensureApiClient(baseUrl);
    try {
      final response = await _apiClient.post(
        '/api/v1/auth/select-context',
        body: {'pendingSelectionToken': token, 'contextRef': contextRef},
      );
      if (response.statusCode != 200) {
        _clearPendingSelection();
        lastLoginError =
            'This login choice is no longer available. Please sign in again.';
        notifyListeners();
        return false;
      }
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      if (!await _storeSession(body)) {
        _clearPendingSelection();
        lastLoginError =
            'This login choice is no longer available. Please sign in again.';
        notifyListeners();
        return false;
      }
      _clearPendingSelection();
      await loadAccessibleModules(baseUrl);
      await fetchEffectivePermissions(baseUrl);
      lastLoginError = null;
      notifyListeners();
      return true;
    } on TimeoutException {
      lastLoginError = 'The selection request timed out. Please try again.';
      notifyListeners();
      return false;
    } catch (_) {
      lastLoginError = 'Unable to complete the selection. Please try again or sign in again.';
      notifyListeners();
      return false;
    }
  }

  void cancelPendingSelection() {
    _clearPendingSelection();
    lastLoginError = null;
    notifyListeners();
  }

  void _clearPendingSelection() {
    _pendingSelectionToken = null;
    _pendingContexts = const [];
  }

  void _clearLocalSession() {
    _accessToken = null;
    _refreshToken = null;
    _expiresAt = null;
    currentTenantId = null;
    currentBranchId = null;
    currentUser = null;
    contextType = null;
    _postAuthRoute = null;
    availableModules = const [];
    _accessibleModulesLoaded = false;
    authzService.clear();
  }

  String _loginErrorFromResponse(int statusCode, String body) {
    String? message;
    try {
      final decoded = jsonDecode(body);
      if (decoded is Map<String, dynamic>) {
        final value = decoded['message'] ?? decoded['error'];
        if (value is String && value.trim().isNotEmpty) message = value.trim();
      }
    } catch (_) {}
    if (statusCode == 401) return 'Incorrect username or password.';
    if (statusCode == 400 || statusCode == 422)
      return message ?? 'The login request was rejected by the ERP server.';
    if (statusCode >= 500)
      return 'ERP server error (HTTP $statusCode). Please try again later.';
    return message ?? 'Login failed (HTTP $statusCode).';
  }

  Future<bool> _storeSession(Map<String, dynamic> body) async {
    final accessToken = body['accessToken'];
    final refreshToken = body['refreshToken'];
    if (accessToken is! String ||
        accessToken.isEmpty ||
        refreshToken is! String ||
        refreshToken.isEmpty) {
      return false;
    }
    contextType = body['contextType']?.toString() ?? 'tenant';
    _accessToken = accessToken;
    _refreshToken = refreshToken;
    _expiresAt = DateTime.tryParse(body['expiresAt']?.toString() ?? '');
    if (_expiresAt == null) return false;
    _postAuthRoute = _safeDestination(
      body['destination']?.toString(),
      contextType,
    );
    currentUser = body['user'] as Map<String, dynamic>?;
    final s = (body['session'] as Map<String, dynamic>?) ?? {};
    final tenant = (s['tenantId'] ?? currentUser?['tenantId'] ?? '')
        .toString()
        .trim();
    currentTenantId = tenant.isEmpty ? null : tenant;
    final branch = (s['branchId'] ?? '').toString().trim();
    currentBranchId = branch.isEmpty ? null : branch;
    await _secureStorage.write(key: 'access_token', value: _accessToken!);
    await _secureStorage.write(key: 'refresh_token', value: _refreshToken!);
    await _secureStorage.write(
      key: 'expires_at',
      value: _expiresAt!.toIso8601String(),
    );
    if (currentTenantId != null)
      await _secureStorage.write(key: 'tenant_id', value: currentTenantId!);
    else
      await _secureStorage.delete(key: 'tenant_id');
    if (contextType != null)
      await _secureStorage.write(key: 'context_type', value: contextType!);
    if (currentBranchId != null)
      await _secureStorage.write(key: 'branch_id', value: currentBranchId!);
    else
      await _secureStorage.delete(key: 'branch_id');
    return true;
  }

  String _safeDestination(String? destination, String? type) {
    if (destination == '/platform' && type == 'platform') return destination!;
    if (destination == '/dashboard' && type == 'tenant') return destination!;
    return type == 'platform' ? '/platform' : '/dashboard';
  }

  Future<bool> loadMe(String baseUrl) async {
    if (_accessToken == null) return false;
    _ensureApiClient(baseUrl);
    try {
      final r = await _apiClient.get('/api/v1/auth/me');
      if (r.statusCode != 200) return false;
      final b = jsonDecode(r.body) as Map<String, dynamic>;
      currentUser = b['user'] as Map<String, dynamic>?;
      currentTenantId = (currentUser?['tenantId'] ?? currentTenantId)
          ?.toString();
      currentBranchId = (currentUser?['branchId'])?.toString();
      if (currentBranchId != null && currentBranchId!.isNotEmpty)
        await _secureStorage.write(key: 'branch_id', value: currentBranchId!);
      else
        await _secureStorage.delete(key: 'branch_id');
      notifyListeners();
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<bool> tryRefresh() async {
    if (_refreshRequest != null) return _refreshRequest!;
    if (_refreshToken == null || _refreshToken!.isEmpty) return false;

    _refreshRequest = _performRefresh();
    try {
      return await _refreshRequest!;
    } finally {
      _refreshRequest = null;
    }
  }

  Future<bool> _performRefresh() async {
    try {
      final r = await _apiClient.post(
        '/api/v1/auth/refresh',
        body: {'refreshToken': _refreshToken},
      );
      if (r.statusCode != 200) return false;
      final b = jsonDecode(r.body) as Map<String, dynamic>;
      _accessToken = b['accessToken'] as String?;
      _expiresAt =
          DateTime.tryParse(b['expiresAt']?.toString() ?? '') ?? _expiresAt;
      if (_accessToken != null) {
        await _secureStorage.write(key: 'access_token', value: _accessToken!);
      }
      notifyListeners();
      return _accessToken != null;
    } catch (_) {
      return false;
    }
  }

  String _currentBaseUrl = const String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:3000',
  );
  Future<bool> restoreSession(String baseUrl) async {
    _currentBaseUrl = baseUrl;
    if (_accessToken == null || _refreshToken == null) return false;
    if (_expiresAt != null && DateTime.now().isAfter(_expiresAt!)) {
      if (!await tryRefresh()) {
        await logout();
        return false;
      }
    }
    if (!await loadMe(baseUrl)) {
      if (!await tryRefresh() || !await loadMe(baseUrl)) {
        await logout();
        return false;
      }
    }
    await loadAccessibleModules(baseUrl);
    await fetchEffectivePermissions(baseUrl);
    return true;
  }

  Future<bool> loadAccessibleModules(String baseUrl) async {
    if (_accessToken == null) return false;
    _currentBaseUrl = baseUrl;
    _ensureApiClient(baseUrl);
    try {
      final r = await _apiClient.get('/api/v1/auth/modules');
      if (r.statusCode != 200) return false;
      final b = jsonDecode(r.body) as Map<String, dynamic>;
      availableModules = ((b['modules'] as List<dynamic>?) ?? const [])
          .map((x) => Map<String, dynamic>.from(x as Map))
          .toList();
      _accessibleModulesLoaded = true;
      notifyListeners();
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<List<String>> fetchEffectivePermissions(String baseUrl) async {
    if (_accessToken == null || currentUser == null) return [];
    _currentBaseUrl = baseUrl;
    _ensureApiClient(baseUrl);
    final id = currentUser?['id'] as String?;
    if (id == null) return [];
    return authzService.loadPermissions(_apiClient, id);
  }

  bool hasPermission(String key) => authzService.hasPermission(key);
  bool hasModule(String code) =>
      code.trim().isEmpty ||
      (_accessibleModulesLoaded &&
          availableModules.any(
            (m) => (m['code'] ?? '').toString() == code.trim(),
          ));
  Future<void> logout() async {
    try {
      if (_accessToken != null) {
        _ensureApiClient(_currentBaseUrl);
        await _apiClient.post('/api/v1/auth/logout');
      }
    } catch (_) {}
    _refreshRequest = null;
    _clearLocalSession();
    _clearPendingSelection();
    for (final k in [
      'access_token',
      'refresh_token',
      'expires_at',
      'tenant_id',
      'context_type',
      'branch_id',
    ])
      await _secureStorage.delete(key: k);
    notifyListeners();
  }
}
