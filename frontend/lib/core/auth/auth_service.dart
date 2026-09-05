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
  String? currentTenantId,
      currentOrganizationId,
      currentBranchId,
      currentLocationId;
  String? selectedOrganizationId, selectedBranchId, selectedLocationId;
  Map<String, dynamic>? currentUser, deploymentInfo;
  List<Map<String, dynamic>> availableOrganizations = const [],
      availableBranches = const [],
      availableLocations = const [],
      availableModules = const [];
  bool _accessibleModulesLoaded = false;
  bool requiresOrganizationSelection = false,
      requiresBranchSelection = false,
      requiresLocationSelection = false;
  String? lastLoginError;
  bool get isAuthenticated =>
      _accessToken != null &&
      _expiresAt != null &&
      DateTime.now().isBefore(_expiresAt!);
  String? get accessToken => _accessToken;
  String get nextPostAuthRoute => isAuthenticated ? '/dashboard' : '/login';
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
    currentOrganizationId = await _secureStorage.read(key: 'organization_id');
    currentBranchId = await _secureStorage.read(key: 'branch_id');
    currentLocationId = await _secureStorage.read(key: 'location_id');
    selectedOrganizationId = currentOrganizationId;
    selectedBranchId = currentBranchId;
    selectedLocationId = currentLocationId;
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
      await _storeSession(jsonDecode(r.body) as Map<String, dynamic>);
      // Context is initialized from the user's configured defaults when available. Missing defaults do not block login.
      await loadAuthorizedOrganizations(baseUrl);
      if (currentOrganizationId != null) {
        await loadAuthorizedBranches(baseUrl);
        await loadAuthorizedLocations(baseUrl);
        await loadAccessibleModules(baseUrl);
        await _loadPermissionsIfContextReady(baseUrl);
      }
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

  Future<void> _storeSession(Map<String, dynamic> body) async {
    _accessToken = body['accessToken'] as String?;
    _refreshToken = body['refreshToken'] as String?;
    _expiresAt = DateTime.tryParse(body['expiresAt']?.toString() ?? '');
    currentUser = body['user'] as Map<String, dynamic>?;
    final s = (body['session'] as Map<String, dynamic>?) ?? {};
    final tenant = (s['tenantId'] ?? currentUser?['tenantId'] ?? '')
        .toString()
        .trim();
    currentTenantId = tenant.isEmpty ? null : tenant;
    final org = (s['organizationId'] ?? currentUser?['organizationId'] ?? '')
        .toString()
        .trim();
    currentOrganizationId = org.isEmpty ? null : org;
    final branch = (s['branchId'] ?? currentUser?['defaultBranchId'] ?? '')
        .toString()
        .trim();
    currentBranchId = branch.isEmpty ? null : branch;
    final loc =
        (s['locationId'] ??
                currentUser?['activeLocationId'] ??
                currentUser?['defaultLocationId'] ??
                '')
            .toString()
            .trim();
    currentLocationId = loc.isEmpty ? null : loc;
    selectedOrganizationId = currentOrganizationId;
    selectedBranchId = currentBranchId;
    selectedLocationId = currentLocationId;
    if (_accessToken != null)
      await _secureStorage.write(key: 'access_token', value: _accessToken!);
    if (_refreshToken != null)
      await _secureStorage.write(key: 'refresh_token', value: _refreshToken!);
    if (_expiresAt != null)
      await _secureStorage.write(
        key: 'expires_at',
        value: _expiresAt!.toIso8601String(),
      );
    if (currentTenantId != null)
      await _secureStorage.write(key: 'tenant_id', value: currentTenantId!);
    if (currentOrganizationId != null)
      await _secureStorage.write(
        key: 'organization_id',
        value: currentOrganizationId!,
      );
    if (currentBranchId != null)
      await _secureStorage.write(key: 'branch_id', value: currentBranchId!);
    if (currentLocationId != null)
      await _secureStorage.write(key: 'location_id', value: currentLocationId!);
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
      currentOrganizationId =
          (currentUser?['organizationId'] ?? currentOrganizationId)?.toString();
      currentBranchId = (currentUser?['defaultBranchId'] ?? currentBranchId)
          ?.toString();
      currentLocationId =
          (currentUser?['activeLocationId'] ??
                  currentUser?['defaultLocationId'] ??
                  currentLocationId)
              ?.toString();
      selectedOrganizationId = currentOrganizationId;
      selectedBranchId = currentBranchId;
      selectedLocationId = currentLocationId;
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
    await loadAuthorizedOrganizations(baseUrl);
    if (currentOrganizationId != null) {
      await loadAuthorizedBranches(baseUrl);
      await loadAuthorizedLocations(baseUrl);
      await loadAccessibleModules(baseUrl);
      await _loadPermissionsIfContextReady(baseUrl);
    }
    return true;
  }

  Future<bool> loadAuthorizedOrganizations(String baseUrl) async {
    if (_accessToken == null) return false;
    _currentBaseUrl = baseUrl;
    _ensureApiClient(baseUrl);
    try {
      final r = await _apiClient.get('/api/v1/auth/organizations');
      if (r.statusCode != 200) return false;
      final b = jsonDecode(r.body) as Map<String, dynamic>;
      final organizations = (b['organizations'] as List<dynamic>?) ?? const [];
      availableOrganizations = organizations
          .map((item) => Map<String, dynamic>.from(item as Map))
          .toList();
      requiresOrganizationSelection =
          b['requiresOrganizationSelection'] == true;
      if (requiresOrganizationSelection) {
        currentOrganizationId = null;
        selectedOrganizationId = null;
        await _secureStorage.delete(key: 'organization_id');
      } else {
        final active =
            (b['activeOrganizationId'] ?? currentOrganizationId ?? '')
                .toString()
                .trim();
        if (active.isNotEmpty &&
            availableOrganizations.any(
              (org) => (org['id'] ?? '').toString() == active,
            )) {
          currentOrganizationId = active;
          selectedOrganizationId = active;
          await _secureStorage.write(key: 'organization_id', value: active);
        } else if (availableOrganizations.length == 1) {
          final fallback = (availableOrganizations.first['id'] ?? '')
              .toString();
          if (fallback.isNotEmpty) {
            currentOrganizationId = fallback;
            selectedOrganizationId = fallback;
            await _secureStorage.write(key: 'organization_id', value: fallback);
          }
        }
      }
      notifyListeners();
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<bool> loadAuthorizedBranches(String baseUrl) async {
    if (_accessToken == null || currentOrganizationId == null) return false;
    _currentBaseUrl = baseUrl;
    _ensureApiClient(baseUrl);
    try {
      final r = await _apiClient.get('/api/v1/branches');
      if (r.statusCode != 200) return false;
      final b = jsonDecode(r.body) as Map<String, dynamic>;
      final branches = (b['branches'] as List<dynamic>?) ?? const [];
      availableBranches = branches
          .map((item) => Map<String, dynamic>.from(item as Map))
          .toList();
      final active = (currentBranchId ?? selectedBranchId ?? '')
          .toString()
          .trim();
      requiresBranchSelection = false;
      if (active.isNotEmpty &&
          availableBranches.any(
            (branch) => (branch['id'] ?? '').toString() == active,
          )) {
        currentBranchId = active;
        selectedBranchId = active;
        await _secureStorage.write(key: 'branch_id', value: active);
      } else if (availableBranches.isNotEmpty) {
        final fallback = (availableBranches.first['id'] ?? '').toString();
        if (fallback.isNotEmpty) {
          currentBranchId = fallback;
          selectedBranchId = fallback;
          await _secureStorage.write(key: 'branch_id', value: fallback);
        }
      } else {
        currentBranchId = null;
        selectedBranchId = null;
        await _secureStorage.delete(key: 'branch_id');
      }
      notifyListeners();
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<bool> selectOrganization(String organizationId) async {
    final id = organizationId.trim();
    if (id.isEmpty ||
        !availableOrganizations.any(
          (org) => (org['id'] ?? '').toString() == id,
        ))
      return false;
    final previousOrg = currentOrganizationId;
    final previousBranch = currentBranchId;
    final previousLocation = currentLocationId;
    try {
      final base = _currentBaseUrl;
      _ensureApiClient(base);
      currentOrganizationId = id;
      selectedOrganizationId = id;
      await loadAuthorizedBranches(base);
      await loadAuthorizedLocations(base);
      final resolvedBranchId =
          (availableBranches.any(
            (branch) =>
                (branch['id'] ?? '').toString() ==
                (selectedBranchId ?? currentBranchId ?? ''),
          )
          ? (selectedBranchId ?? currentBranchId)
          : (availableBranches.isNotEmpty
                ? (availableBranches.first['id'] ?? '').toString()
                : null));
      final resolvedLocationId =
          (availableLocations.any(
            (location) =>
                (location['id'] ?? '').toString() ==
                (selectedLocationId ?? currentLocationId ?? ''),
          )
          ? (selectedLocationId ?? currentLocationId)
          : (availableLocations.isNotEmpty
                ? (availableLocations.first['id'] ?? '').toString()
                : null));
      if (resolvedBranchId == null || resolvedLocationId == null) {
        currentOrganizationId = previousOrg;
        selectedOrganizationId = previousOrg;
        currentBranchId = previousBranch;
        selectedBranchId = previousBranch;
        currentLocationId = previousLocation;
        selectedLocationId = previousLocation;
        return false;
      }
      final ok = await applyWorkingContext(
        organizationId: id,
        branchId: resolvedBranchId,
        locationId: resolvedLocationId,
      );
      if (!ok) {
        currentOrganizationId = previousOrg;
        selectedOrganizationId = previousOrg;
        currentBranchId = previousBranch;
        selectedBranchId = previousBranch;
        currentLocationId = previousLocation;
        selectedLocationId = previousLocation;
      }
      return ok;
    } catch (_) {
      currentOrganizationId = previousOrg;
      selectedOrganizationId = previousOrg;
      currentBranchId = previousBranch;
      selectedBranchId = previousBranch;
      currentLocationId = previousLocation;
      selectedLocationId = previousLocation;
      return false;
    }
  }

  Future<bool> applyWorkingContext({
    required String organizationId,
    required String branchId,
    required String locationId,
  }) async {
    final base = _currentBaseUrl;
    _ensureApiClient(base);
    try {
      final r = await _apiClient.post(
        '/api/v1/auth/context/select',
        body: {
          'organizationId': organizationId,
          'branchId': branchId,
          'locationId': locationId,
        },
      );
      if (r.statusCode != 200) return false;
      await _storeSession(jsonDecode(r.body) as Map<String, dynamic>);
      currentOrganizationId = organizationId;
      selectedOrganizationId = organizationId;
      currentBranchId = branchId;
      selectedBranchId = branchId;
      currentLocationId = locationId;
      selectedLocationId = locationId;
      requiresOrganizationSelection = false;
      requiresBranchSelection = false;
      requiresLocationSelection = false;
      await loadAccessibleModules(base);
      await _loadPermissionsIfContextReady(base);
      notifyListeners();
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<bool> loadAuthorizedLocations(String baseUrl) async {
    if (_accessToken == null || currentOrganizationId == null) return false;
    _currentBaseUrl = baseUrl;
    _ensureApiClient(baseUrl);
    try {
      final r = await _apiClient.get('/api/v1/locations');
      if (r.statusCode != 200) return false;
      final b = jsonDecode(r.body) as Map<String, dynamic>;
      final l = (b['locations'] as List<dynamic>?) ?? const [];
      availableLocations = l
          .map((x) => Map<String, dynamic>.from(x as Map))
          .toList();
      final active = (currentLocationId ?? selectedLocationId ?? '')
          .toString()
          .trim();
      requiresLocationSelection = false;
      if (active.isNotEmpty &&
          availableLocations.any((x) => (x['id'] ?? '').toString() == active)) {
        currentLocationId = active;
        selectedLocationId = active;
        await _secureStorage.write(key: 'location_id', value: active);
      } else if (availableLocations.isNotEmpty) {
        final fallback = (availableLocations.first['id'] ?? '').toString();
        if (fallback.isNotEmpty) {
          currentLocationId = fallback;
          selectedLocationId = fallback;
          await _secureStorage.write(key: 'location_id', value: fallback);
        }
      } else {
        currentLocationId = null;
        selectedLocationId = null;
        await _secureStorage.delete(key: 'location_id');
      }
      notifyListeners();
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<bool> selectBranch(String branchId) async {
    final id = branchId.trim();
    if (id.isEmpty ||
        !availableBranches.any((o) => (o['id'] ?? '').toString() == id))
      return false;
    final orgId = currentOrganizationId ?? selectedOrganizationId;
    final preferredLocationId =
        (availableLocations.any(
          (l) =>
              (l['id'] ?? '').toString() ==
              (selectedLocationId ?? currentLocationId ?? ''),
        )
        ? (selectedLocationId ?? currentLocationId)
        : (availableLocations.isNotEmpty
              ? (availableLocations.first['id'] ?? '').toString()
              : null));
    if (orgId == null || preferredLocationId == null) return false;
    return applyWorkingContext(
      organizationId: orgId,
      branchId: id,
      locationId: preferredLocationId,
    );
  }

  Future<bool> selectLocation(String locationId) async {
    final id = locationId.trim();
    if (id.isEmpty ||
        !availableLocations.any((o) => (o['id'] ?? '').toString() == id))
      return false;
    final orgId = currentOrganizationId ?? selectedOrganizationId;
    final preferredBranchId =
        (availableBranches.any(
          (b) =>
              (b['id'] ?? '').toString() ==
              (selectedBranchId ?? currentBranchId ?? ''),
        )
        ? (selectedBranchId ?? currentBranchId)
        : (availableBranches.isNotEmpty
              ? (availableBranches.first['id'] ?? '').toString()
              : null));
    if (orgId == null || preferredBranchId == null) return false;
    return applyWorkingContext(
      organizationId: orgId,
      branchId: preferredBranchId,
      locationId: id,
    );
  }

  Future<bool> loadAccessibleModules(String baseUrl) async {
    if (_accessToken == null || currentOrganizationId == null) return false;
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

  Future<void> _loadPermissionsIfContextReady(String baseUrl) async {
    if (_accessToken == null ||
        currentUser == null ||
        currentOrganizationId == null)
      return;
    await fetchEffectivePermissions(baseUrl);
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
    _accessToken = null;
    _refreshToken = null;
    _expiresAt = null;
    currentTenantId = null;
    currentOrganizationId = null;
    currentBranchId = null;
    currentLocationId = null;
    selectedOrganizationId = null;
    selectedBranchId = null;
    selectedLocationId = null;
    currentUser = null;
    availableOrganizations = const [];
    availableBranches = const [];
    availableLocations = const [];
    availableModules = const [];
    _accessibleModulesLoaded = false;
    requiresOrganizationSelection = false;
    requiresBranchSelection = false;
    requiresLocationSelection = false;
    authzService.clear();
    for (final k in [
      'access_token',
      'refresh_token',
      'expires_at',
      'tenant_id',
      'organization_id',
      'branch_id',
      'location_id',
    ])
      await _secureStorage.delete(key: k);
    notifyListeners();
  }
}
