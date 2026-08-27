import 'dart:convert';

import 'authz_service.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../network/api_client.dart';

abstract class SecureStorageLike {
  Future<String?> read({required String key});
  Future<void> write({required String key, required String value});
  Future<void> delete({required String key});
}

class FlutterSecureStorageAdapter implements SecureStorageLike {
  final FlutterSecureStorage _inner = FlutterSecureStorage();
  @override Future<String?> read({required String key}) => _inner.read(key: key);
  @override Future<void> write({required String key, required String value}) => _inner.write(key: key, value: value);
  @override Future<void> delete({required String key}) => _inner.delete(key: key);
}

class AuthService extends ChangeNotifier {
  final AuthZService authzService;
  final SecureStorageLike _secureStorage;
  final ApiClient Function(String baseUrl) _apiClientFactory;
  late ApiClient _apiClient;

  AuthService({SecureStorageLike? secureStorage, ApiClient Function(String baseUrl)? apiClientFactory, AuthZService? authzService})
      : _secureStorage = secureStorage ?? FlutterSecureStorageAdapter(),
        _apiClientFactory = apiClientFactory ?? ((baseUrl) => ApiClient(baseUrl: baseUrl)),
        authzService = authzService ?? AuthZService();

  String? _accessToken;
  String? _refreshToken;
  DateTime? _expiresAt;
  String? currentTenantId;
  String? currentOrganizationId;
  String? currentLocationId;
  String? selectedOrganizationId;
  String? selectedLocationId;
  Map<String, dynamic>? currentUser;
  Map<String, dynamic>? deploymentInfo;
  List<Map<String, dynamic>> availableOrganizations = const [];
  List<Map<String, dynamic>> availableLocations = const [];
  List<Map<String, dynamic>> availableModules = const [];
  bool requiresOrganizationSelection = false;
  bool requiresLocationSelection = false;

  bool get isAuthenticated => _accessToken != null && _expiresAt != null && DateTime.now().isBefore(_expiresAt!);
  String? get accessToken => _accessToken;
  String get nextPostAuthRoute {
    if (!isAuthenticated) return '/login';
    if (requiresOrganizationSelection) return '/organization-selection';
    if (requiresLocationSelection) return '/location-selection';
    return '/dashboard';
  }

  void _ensureApiClient(String baseUrl) => _apiClient = _apiClientFactory(baseUrl);

  Future<void> init() async {
    _accessToken = await _secureStorage.read(key: 'access_token');
    _refreshToken = await _secureStorage.read(key: 'refresh_token');
    final exp = await _secureStorage.read(key: 'expires_at');
    currentTenantId = await _secureStorage.read(key: 'tenant_id');
    currentOrganizationId = await _secureStorage.read(key: 'organization_id');
    currentLocationId = await _secureStorage.read(key: 'location_id');
    selectedOrganizationId = currentOrganizationId;
    selectedLocationId = currentLocationId;
    if (exp != null) _expiresAt = DateTime.tryParse(exp);
    if (_accessToken != null) notifyListeners();
  }

  Future<Map<String, dynamic>?> bootstrap(String baseUrl) async {
    _ensureApiClient(baseUrl);
    try {
      final resp = await _apiClient.get('/api/v1/bootstrap');
      if (resp.statusCode != 200) return null;
      final body = jsonDecode(resp.body) as Map<String, dynamic>;
      deploymentInfo = (body['deployment'] as Map<String, dynamic>?) ?? {};
      notifyListeners();
      return body;
    } catch (_) { deploymentInfo = null; notifyListeners(); return null; }
  }

  Future<bool> login(String baseUrl, String identifier, String password) async {
    _ensureApiClient(baseUrl);
    try {
      final resp = await _apiClient.post('/api/v1/auth/login', body: {'identifier': identifier, 'password': password});
      if (resp.statusCode != 200) return false;
      await _storeSession(jsonDecode(resp.body) as Map<String, dynamic>);
      final organizationsLoaded = await loadAuthorizedOrganizations(baseUrl);
      if (!organizationsLoaded) return false;
      if (requiresOrganizationSelection || currentOrganizationId == null) {
        availableLocations = const [];
        availableModules = const [];
        requiresLocationSelection = false;
        authzService.clear();
        notifyListeners();
        return true;
      }
      await loadAuthorizedLocations(baseUrl);
      await loadAccessibleModules(baseUrl);
      await _loadPermissionsIfContextReady(baseUrl);
      notifyListeners();
      return true;
    } catch (_) { return false; }
  }

  Future<void> _storeSession(Map<String, dynamic> body) async {
    _accessToken = body['accessToken'] as String?;
    _refreshToken = body['refreshToken'] as String?;
    _expiresAt = DateTime.tryParse(body['expiresAt']?.toString() ?? '');
    currentUser = body['user'] as Map<String, dynamic>?;
    final session = (body['session'] as Map<String, dynamic>?) ?? {};
    final tenant = (session['tenantId'] ?? currentUser?['tenantId'] ?? '').toString().trim();
    currentTenantId = tenant.isEmpty ? null : tenant;
    final organization = (session['organizationId'] ?? currentUser?['organizationId'] ?? '').toString().trim();
    currentOrganizationId = organization.isEmpty ? null : organization;
    currentLocationId = (session['locationId'] ?? currentUser?['activeLocationId'] ?? '').toString().trim();
    if (currentLocationId?.isEmpty ?? true) currentLocationId = null;
    selectedOrganizationId = currentOrganizationId;
    selectedLocationId = currentLocationId;
    if (_accessToken != null) await _secureStorage.write(key: 'access_token', value: _accessToken!);
    if (_refreshToken != null) await _secureStorage.write(key: 'refresh_token', value: _refreshToken!);
    if (_expiresAt != null) await _secureStorage.write(key: 'expires_at', value: _expiresAt!.toIso8601String());
    if (currentTenantId != null) await _secureStorage.write(key: 'tenant_id', value: currentTenantId!);
    if (currentOrganizationId != null) await _secureStorage.write(key: 'organization_id', value: currentOrganizationId!);
    if (currentLocationId != null) await _secureStorage.write(key: 'location_id', value: currentLocationId!);
  }

  Future<bool> loadMe(String baseUrl) async {
    if (_accessToken == null) return false;
    _ensureApiClient(baseUrl);
    try {
      final resp = await _apiClient.get('/api/v1/auth/me');
      if (resp.statusCode != 200) return false;
      final body = jsonDecode(resp.body) as Map<String, dynamic>;
      currentUser = body['user'] as Map<String, dynamic>?;
      final tenant = (currentUser?['tenantId'] ?? '').toString().trim();
      if (tenant.isNotEmpty) currentTenantId = tenant;
      currentOrganizationId = (currentUser?['organizationId'] ?? '').toString().trim();
      if (currentOrganizationId?.isEmpty ?? true) currentOrganizationId = null;
      currentLocationId = (currentUser?['activeLocationId'] ?? '').toString().trim();
      if (currentLocationId?.isEmpty ?? true) currentLocationId = null;
      notifyListeners();
      return true;
    } catch (_) { return false; }
  }

  Future<bool> tryRefresh() async {
    if (_refreshToken == null || _refreshToken!.isEmpty) return false;
    try {
      final resp = await _apiClient.post('/api/v1/auth/refresh', body: {'refreshToken': _refreshToken});
      if (resp.statusCode != 200) return false;
      final body = jsonDecode(resp.body) as Map<String, dynamic>;
      _accessToken = body['accessToken'] as String?;
      _expiresAt = DateTime.tryParse(body['expiresAt']?.toString() ?? '') ?? _expiresAt;
      currentUser = body['user'] as Map<String, dynamic>? ?? currentUser;
      if (_accessToken != null) await _secureStorage.write(key: 'access_token', value: _accessToken!);
      if (_expiresAt != null) await _secureStorage.write(key: 'expires_at', value: _expiresAt!.toIso8601String());
      notifyListeners();
      return _accessToken != null;
    } catch (_) { return false; }
  }

  String _currentBaseUrl = const String.fromEnvironment('API_BASE_URL', defaultValue: 'http://localhost:3000');
  String _determineBaseUrl() => _currentBaseUrl;

  Future<bool> restoreSession(String baseUrl) async {
    _currentBaseUrl = baseUrl;
    if (_accessToken == null || _refreshToken == null) return false;
    if (_expiresAt != null && DateTime.now().isAfter(_expiresAt!)) {
      if (!await tryRefresh()) { await logout(); return false; }
    }
    if (!await loadMe(baseUrl)) {
      if (!await tryRefresh() || !await loadMe(baseUrl)) { await logout(); return false; }
    }
    if (!await loadAuthorizedOrganizations(baseUrl)) return false;
    if (requiresOrganizationSelection || currentOrganizationId == null) { requiresLocationSelection = false; notifyListeners(); return true; }
    await loadAuthorizedLocations(baseUrl);
    await loadAccessibleModules(baseUrl);
    await _loadPermissionsIfContextReady(baseUrl);
    notifyListeners();
    return true;
  }

  Future<bool> loadAuthorizedOrganizations(String baseUrl) async {
    if (_accessToken == null) return false;
    _currentBaseUrl = baseUrl;
    _ensureApiClient(baseUrl);
    try {
      final resp = await _apiClient.get('/api/v1/auth/organizations');
      if (resp.statusCode != 200) return false;
      final body = jsonDecode(resp.body) as Map<String, dynamic>;
      final list = (body['organizations'] as List<dynamic>?) ?? const [];
      availableOrganizations = list.map((item) => Map<String, dynamic>.from(item as Map)).toList();
      final active = (body['activeOrganizationId'] ?? '').toString().trim();
      requiresOrganizationSelection = body['requiresOrganizationSelection'] == true;
      if (active.isNotEmpty) {
        currentOrganizationId = active;
        selectedOrganizationId = active;
        await _secureStorage.write(key: 'organization_id', value: active);
      } else if (requiresOrganizationSelection) {
        currentOrganizationId = null;
        selectedOrganizationId = null;
        await _secureStorage.delete(key: 'organization_id');
      }
      notifyListeners();
      return true;
    } catch (_) { return false; }
  }

  Future<bool> selectOrganization(String organizationId) async {
    final normalized = organizationId.trim();
    if (normalized.isEmpty || !availableOrganizations.any((org) => (org['id'] ?? '').toString() == normalized)) return false;
    try {
      final baseUrl = _determineBaseUrl();
      _ensureApiClient(baseUrl);
      final resp = await _apiClient.post('/api/v1/auth/organizations/select', body: {'organizationId': normalized});
      if (resp.statusCode != 200) return false;
      await _storeSession(jsonDecode(resp.body) as Map<String, dynamic>);
      requiresOrganizationSelection = false;
      await loadAuthorizedLocations(baseUrl);
      await loadAccessibleModules(baseUrl);
      await _loadPermissionsIfContextReady(baseUrl);
      notifyListeners();
      return true;
    } catch (_) { return false; }
  }

  Future<bool> loadAuthorizedLocations(String baseUrl) async {
    if (_accessToken == null || currentOrganizationId == null) return false;
    _currentBaseUrl = baseUrl;
    _ensureApiClient(baseUrl);
    try {
      final resp = await _apiClient.get('/api/v1/locations');
      if (resp.statusCode != 200) return false;
      final body = jsonDecode(resp.body) as Map<String, dynamic>;
      final list = (body['locations'] as List<dynamic>?) ?? const [];
      availableLocations = list.map((item) => Map<String, dynamic>.from(item as Map)).toList();
      if (currentLocationId != null && availableLocations.any((l) => (l['id'] ?? '').toString() == currentLocationId)) {
        requiresLocationSelection = false;
      } else if (availableLocations.length == 1) {
        currentLocationId = (availableLocations.first['id'] ?? '').toString();
        selectedLocationId = currentLocationId;
        requiresLocationSelection = false;
        await _secureStorage.write(key: 'location_id', value: currentLocationId!);
      } else {
        currentLocationId = null;
        selectedLocationId = null;
        requiresLocationSelection = availableLocations.length > 1;
        await _secureStorage.delete(key: 'location_id');
      }
      notifyListeners();
      return true;
    } catch (_) { return false; }
  }

  Future<bool> selectLocation(String locationId) async {
    final normalized = locationId.trim();
    if (normalized.isEmpty || !availableLocations.any((location) => (location['id'] ?? '').toString() == normalized)) return false;
    try {
      final baseUrl = _determineBaseUrl();
      _ensureApiClient(baseUrl);
      final resp = await _apiClient.post('/api/v1/locations/$normalized/select');
      if (resp.statusCode != 200) return false;
      await _storeSession(jsonDecode(resp.body) as Map<String, dynamic>);
      currentLocationId = normalized;
      selectedLocationId = normalized;
      requiresLocationSelection = false;
      await _loadPermissionsIfContextReady(baseUrl);
      notifyListeners();
      return true;
    } catch (_) { return false; }
  }

  Future<bool> loadAccessibleModules(String baseUrl) async {
    if (_accessToken == null || currentOrganizationId == null) return false;
    _currentBaseUrl = baseUrl;
    _ensureApiClient(baseUrl);
    try {
      final resp = await _apiClient.get('/api/v1/auth/modules');
      if (resp.statusCode != 200) return false;
      final body = jsonDecode(resp.body) as Map<String, dynamic>;
      final list = (body['modules'] as List<dynamic>?) ?? const [];
      availableModules = list.map((item) => Map<String, dynamic>.from(item as Map)).toList();
      notifyListeners();
      return true;
    } catch (_) { return false; }
  }

  Future<List<String>> fetchEffectivePermissions(String baseUrl) async {
    if (_accessToken == null || currentUser == null) return [];
    _currentBaseUrl = baseUrl;
    _ensureApiClient(baseUrl);
    final userId = currentUser?['id'] as String?;
    if (userId == null) return [];
    return authzService.loadPermissions(_apiClient, userId);
  }

  Future<void> _loadPermissionsIfContextReady(String baseUrl) async {
    if (_accessToken == null || currentUser == null || currentOrganizationId == null) return;
    await fetchEffectivePermissions(baseUrl);
  }

  bool hasPermission(String key) => authzService.hasPermission(key);
  bool hasModule(String moduleCode) => moduleCode.trim().isEmpty || availableModules.isEmpty || availableModules.any((m) => (m['code'] ?? '').toString() == moduleCode.trim());

  Future<void> logout() async {
    try { if (_accessToken != null) { _ensureApiClient(_currentBaseUrl); await _apiClient.post('/api/v1/auth/logout'); } } catch (_) {}
    _accessToken = null; _refreshToken = null; _expiresAt = null; currentTenantId = null; currentOrganizationId = null; currentLocationId = null;
    selectedOrganizationId = null; selectedLocationId = null; currentUser = null; availableOrganizations = const []; availableLocations = const []; availableModules = const [];
    requiresOrganizationSelection = false; requiresLocationSelection = false; authzService.clear();
    for (final key in ['access_token', 'refresh_token', 'expires_at', 'tenant_id', 'organization_id', 'location_id']) { await _secureStorage.delete(key: key); }
    notifyListeners();
  }
}
