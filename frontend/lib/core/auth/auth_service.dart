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

  @override
  Future<String?> read({required String key}) => _inner.read(key: key);

  @override
  Future<void> write({required String key, required String value}) => _inner.write(key: key, value: value);

  @override
  Future<void> delete({required String key}) => _inner.delete(key: key);
}

class AuthService extends ChangeNotifier {
  final AuthZService authzService;
  final SecureStorageLike _secureStorage;
  final ApiClient Function(String baseUrl)? _apiClientFactory;
  late ApiClient _apiClient;

  AuthService({
    SecureStorageLike? secureStorage,
    ApiClient Function(String baseUrl)? apiClientFactory,
      AuthZService? authzService,
    })  : _secureStorage = secureStorage ?? FlutterSecureStorageAdapter(),
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
  bool requiresOrganizationSelection = false;
  bool requiresLocationSelection = false;

  String get nextPostAuthRoute {
    if (!isAuthenticated) {
      return '/login';
    }
    if (requiresOrganizationSelection) {
      return '/organization-selection';
    }
    if (requiresLocationSelection) {
      return '/location-selection';
    }
    return '/dashboard';
  }

  String get configuredTenantId => const String.fromEnvironment(
        'TENANT_ID',
        defaultValue: '',
      );

  bool get isAuthenticated =>
      _accessToken != null && _expiresAt != null && DateTime.now().isBefore(_expiresAt!);
  String? get accessToken => _accessToken;


  void _ensureApiClient(String baseUrl) {
    _apiClient = _apiClientFactory!(baseUrl);
  }

  Future<Map<String, dynamic>?> bootstrap(String baseUrl) async {
    _ensureApiClient(baseUrl);
    try {
      final resp = await _apiClient.get('/api/v1/bootstrap');

      if (resp.statusCode != 200) {
        deploymentInfo = null;
        currentTenantId = null;
        await _secureStorage.delete(key: 'tenant_id');
        notifyListeners();
        return null;
      }

      final body = jsonDecode(resp.body) as Map<String, dynamic>;
      final deployment = (body['deployment'] as Map<String, dynamic>?) ?? {};
      final tenantId = (deployment['tenantId'] ?? '').toString().trim();
      deploymentInfo = deployment;
      currentTenantId = tenantId.isEmpty ? null : tenantId;

      if (currentTenantId != null && currentTenantId!.isNotEmpty) {
        await _secureStorage.write(key: 'tenant_id', value: currentTenantId!);
      } else {
        await _secureStorage.delete(key: 'tenant_id');
      }

      notifyListeners();
      return body;
    } catch (_) {
      deploymentInfo = null;
      currentTenantId = null;
      await _secureStorage.delete(key: 'tenant_id');
      notifyListeners();
      return null;
    }
  }

  Future<List<String>> fetchEffectivePermissions(String baseUrl) async {
      _ensureApiClient(baseUrl);
      if (_accessToken == null || currentUser == null) return [];
      final userId = currentUser!['id'] as String?;
      if (userId == null) return [];
      final perms = await authzService.loadPermissions(_apiClient, userId);
      return perms;
    }

    bool hasPermission(String key) {
      // Delegate to authzService. If not loaded, return false to avoid optimistic allow.
      return authzService.hasPermission(key);
    }

  Future<void> init() async {
    _accessToken = await _secureStorage.read(key: 'access_token');
    _refreshToken = await _secureStorage.read(key: 'refresh_token');
    final exp = await _secureStorage.read(key: 'expires_at');
    currentTenantId = await _secureStorage.read(key: 'tenant_id');
    currentOrganizationId = await _secureStorage.read(key: 'organization_id');
    currentLocationId = await _secureStorage.read(key: 'location_id');
    selectedOrganizationId = currentOrganizationId;
    selectedLocationId = currentLocationId;
    if (exp != null) {
      _expiresAt = DateTime.tryParse(exp);
    }

    if (_accessToken != null && _refreshToken != null && _expiresAt != null) {
      notifyListeners();
    }
  }

  Future<bool> restoreSession(String baseUrl) async {
    if (_accessToken == null || _refreshToken == null) {
      return false;
    }

    if (_expiresAt != null && DateTime.now().isAfter(_expiresAt!)) {
      await logout();
      return false;
    }

    bool loaded = await loadMe(baseUrl);
    if (!loaded) {
      final refreshed = await tryRefresh();
      if (!refreshed) {
        await logout();
        return false;
      }
      loaded = await loadMe(baseUrl);
      if (!loaded) {
        await logout();
        return false;
      }
    }

    final organizationsLoaded = await loadAuthorizedOrganizations(baseUrl);
    final locationsLoaded = await loadAuthorizedLocations(baseUrl);
    notifyListeners();

    return organizationsLoaded || locationsLoaded || loaded;
  }

  Future<bool> login(String baseUrl, String identifier, String password) async {
    _ensureApiClient(baseUrl);
    final bootstrapResponse = await bootstrap(baseUrl);
    if (bootstrapResponse == null || (currentTenantId ?? '').trim().isEmpty) {
      return false;
    }

    try {
      final resp = await _apiClient.post('/api/v1/auth/login', body: {
        'identifier': identifier,
        'password': password,
      });

      if (resp.statusCode != 200) {
        return false;
      }

      final body = jsonDecode(resp.body) as Map<String, dynamic>;
      _accessToken = body['accessToken'] as String?;
      _refreshToken = body['refreshToken'] as String?;
      _expiresAt = DateTime.tryParse(body['expiresAt'] as String? ?? '');
      currentUser = body['user'] as Map<String, dynamic>?;

      final session = (body['session'] as Map<String, dynamic>?) ?? {};
      final resolvedTenantId = (session['tenantId'] ?? currentUser?['tenantId'] ?? currentTenantId ?? '').toString().trim();
      currentTenantId = resolvedTenantId.isEmpty ? null : resolvedTenantId;

      if (currentTenantId != null && currentTenantId!.isNotEmpty) {
        await _secureStorage.write(key: 'tenant_id', value: currentTenantId!);
      }

      if (_accessToken != null && _accessToken!.trim().isNotEmpty) {
        await _secureStorage.write(key: 'access_token', value: _accessToken!);
      }
      if (_refreshToken != null && _refreshToken!.trim().isNotEmpty) {
        await _secureStorage.write(key: 'refresh_token', value: _refreshToken!);
      }
      if (_expiresAt != null) {
        await _secureStorage.write(
          key: 'expires_at',
          value: _expiresAt!.toIso8601String(),
        );
      }

      final orgsLoaded = await loadAuthorizedOrganizations(baseUrl);
      if (!orgsLoaded) {
        notifyListeners();
        return false;
      }

      await loadAuthorizedLocations(baseUrl);

      // Load effective permissions for the authenticated user without blocking the flow
      if (currentUser != null) {
        final userId = currentUser!['id'] as String?;
        if (userId != null) {
          try {
            _ensureApiClient(baseUrl);
            await authzService.loadPermissions(_apiClient, userId);
          } catch (_) {
            // Permission loading failure should not prevent continuation
          }
        }
      }

      notifyListeners();
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<bool> loadAuthorizedOrganizations(String baseUrl) async {
    if (_accessToken == null || _accessToken!.trim().isEmpty) {
      return false;
    }

    try {
      _ensureApiClient(baseUrl);
      final resp = await _apiClient.get('/api/v1/auth/organizations');

      if (resp.statusCode != 200) {
        availableOrganizations = const [];
        requiresOrganizationSelection = false;
        currentOrganizationId = null;
        selectedOrganizationId = null;
        await _secureStorage.delete(key: 'organization_id');
        notifyListeners();
        return false;
      }

      final body = jsonDecode(resp.body) as Map<String, dynamic>;
      final list = (body['organizations'] as List<dynamic>?) ?? const [];
      availableOrganizations = list
          .map((item) => Map<String, dynamic>.from(item as Map))
          .toList();

      final activeOrganizationId = (body['activeOrganizationId'] ?? '').toString().trim();
      requiresOrganizationSelection = body['requiresOrganizationSelection'] == true;

      if (availableOrganizations.isEmpty) {
        currentOrganizationId = null;
        selectedOrganizationId = null;
        await _secureStorage.delete(key: 'organization_id');
      } else if (activeOrganizationId.isNotEmpty) {
        currentOrganizationId = activeOrganizationId;
        selectedOrganizationId = activeOrganizationId;
        await _secureStorage.write(key: 'organization_id', value: activeOrganizationId);
      } else if (requiresOrganizationSelection) {
        currentOrganizationId = null;
        selectedOrganizationId = null;
        await _secureStorage.delete(key: 'organization_id');
      } else {
        currentOrganizationId = null;
        selectedOrganizationId = null;
        await _secureStorage.delete(key: 'organization_id');
        notifyListeners();
        return false;
      }

      notifyListeners();
      return true;
    } catch (_) {
      availableOrganizations = const [];
      requiresOrganizationSelection = false;
      currentOrganizationId = null;
      selectedOrganizationId = null;
      await _secureStorage.delete(key: 'organization_id');
      notifyListeners();
      return false;
    }
  }

  Future<bool> loadAuthorizedLocations(String baseUrl) async {
    if (_accessToken == null || _accessToken!.trim().isEmpty) {
      return false;
    }

    try {
      _ensureApiClient(baseUrl);
      final resp = await _apiClient.get('/api/v1/locations');

      if (resp.statusCode != 200) {
        availableLocations = const [];
        requiresLocationSelection = false;
        currentLocationId = null;
        selectedLocationId = null;
        await _secureStorage.delete(key: 'location_id');
        notifyListeners();
        return false;
      }

      final body = jsonDecode(resp.body) as Map<String, dynamic>;
      final list = (body['locations'] as List<dynamic>?) ?? const [];
      availableLocations = list
          .map((item) => Map<String, dynamic>.from(item as Map))
          .toList();

      final activeLocationId = (body['activeLocationId'] ?? currentLocationId ?? '').toString().trim();
      requiresLocationSelection = availableLocations.length > 1;

      if (availableLocations.isEmpty) {
        currentLocationId = null;
        selectedLocationId = null;
        await _secureStorage.delete(key: 'location_id');
      } else if (activeLocationId.isNotEmpty) {
        currentLocationId = activeLocationId;
        selectedLocationId = activeLocationId;
        await _secureStorage.write(key: 'location_id', value: activeLocationId);
      } else if (availableLocations.length == 1) {
        final fallbackId = (availableLocations.first['id'] ?? '').toString().trim();
        currentLocationId = fallbackId;
        selectedLocationId = fallbackId;
        if (fallbackId.isNotEmpty) {
          await _secureStorage.write(key: 'location_id', value: fallbackId);
        }
      } else {
        currentLocationId = null;
        selectedLocationId = null;
        await _secureStorage.delete(key: 'location_id');
      }

      notifyListeners();
      return true;
    } catch (_) {
      availableLocations = const [];
      requiresLocationSelection = false;
      currentLocationId = null;
      selectedLocationId = null;
      await _secureStorage.delete(key: 'location_id');
      notifyListeners();
      return false;
    }
  }

  Future<bool> selectOrganization(String organizationId) async {
    final normalizedId = organizationId.trim();
    if (normalizedId.isEmpty) {
      return false;
    }

    final match = availableOrganizations.where((org) => (org['id'] ?? '').toString() == normalizedId).isNotEmpty;
    if (!match) {
      return false;
    }

    try {
      final baseUrl = _determineBaseUrl();
      _ensureApiClient(baseUrl);
      final resp = await _apiClient.post('/api/v1/auth/organizations/select', body: {
        'organizationId': normalizedId,
      });

      if (resp.statusCode != 200) {
        return false;
      }

      final body = jsonDecode(resp.body) as Map<String, dynamic>;

      _accessToken = body['accessToken'] as String? ?? _accessToken;
      _refreshToken = body['refreshToken'] as String? ?? _refreshToken;
      _expiresAt = DateTime.tryParse(body['expiresAt']?.toString() ?? '') ?? _expiresAt;
      currentUser = body['user'] as Map<String, dynamic>? ?? currentUser;

      final session = (body['session'] as Map<String, dynamic>?) ?? {};
      final resolvedTenantId = (session['tenantId'] ?? currentTenantId ?? '').toString().trim();
      currentTenantId = resolvedTenantId.isEmpty ? currentTenantId : resolvedTenantId;
      currentOrganizationId = (session['organizationId'] ?? normalizedId).toString();
      selectedOrganizationId = currentOrganizationId;

      if (_accessToken != null && _accessToken!.trim().isNotEmpty) {
        await _secureStorage.write(key: 'access_token', value: _accessToken!);
      }
      if (_refreshToken != null && _refreshToken!.trim().isNotEmpty) {
        await _secureStorage.write(key: 'refresh_token', value: _refreshToken!);
      }
      if (_expiresAt != null) {
        await _secureStorage.write(key: 'expires_at', value: _expiresAt!.toIso8601String());
      }
      if (currentOrganizationId != null) {
        await _secureStorage.write(key: 'organization_id', value: currentOrganizationId!);
      }

      await loadAuthorizedOrganizations(_determineBaseUrl());
      await loadAuthorizedLocations(_determineBaseUrl());

      notifyListeners();
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<bool> selectLocation(String locationId) async {
    final normalizedId = locationId.trim();
    if (normalizedId.isEmpty) {
      return false;
    }

    final match = availableLocations.where((location) => (location['id'] ?? '').toString() == normalizedId).isNotEmpty;
    if (!match) {
      return false;
    }

    try {
      final baseUrl = _determineBaseUrl();
      _ensureApiClient(baseUrl);
      final resp = await _apiClient.post('/api/v1/locations/$normalizedId/select');
      if (resp.statusCode != 200) {
        return false;
      }

      final body = jsonDecode(resp.body) as Map<String, dynamic>;
      _accessToken = body['accessToken'] as String? ?? _accessToken;
      _refreshToken = body['refreshToken'] as String? ?? _refreshToken;
      _expiresAt = DateTime.tryParse(body['expiresAt']?.toString() ?? '') ?? _expiresAt;
      currentUser = body['user'] as Map<String, dynamic>? ?? currentUser;

      final session = (body['session'] as Map<String, dynamic>?) ?? {};
      currentOrganizationId = ((session['organizationId'] ?? currentOrganizationId ?? '').toString().trim().isEmpty
              ? currentOrganizationId
              : session['organizationId'])
          .toString();
      currentLocationId = (session['locationId'] ?? normalizedId).toString();
      selectedLocationId = currentLocationId;

      if (_accessToken != null && _accessToken!.trim().isNotEmpty) {
        await _secureStorage.write(key: 'access_token', value: _accessToken!);
      }
      if (_refreshToken != null && _refreshToken!.trim().isNotEmpty) {
        await _secureStorage.write(key: 'refresh_token', value: _refreshToken!);
      }
      if (_expiresAt != null) {
        await _secureStorage.write(key: 'expires_at', value: _expiresAt!.toIso8601String());
      }
      if (currentLocationId != null) {
        await _secureStorage.write(key: 'location_id', value: currentLocationId!);
      }

      final userMap = (body['user'] as Map<String, dynamic>?) ?? {};
      final userOrg = (userMap['organizationId'] ?? currentOrganizationId ?? '').toString();
      if (userOrg.isNotEmpty) {
        currentOrganizationId = userOrg;
        selectedOrganizationId = userOrg;
        await _secureStorage.write(key: 'organization_id', value: userOrg);
      }

      await loadAuthorizedLocations(baseUrl);

      // Load effective permissions for the authenticated user without blocking the flow
      if (currentUser != null) {
        final userId = currentUser!['id'] as String?;
        if (userId != null) {
          try {
            _ensureApiClient(baseUrl);
            await authzService.loadPermissions(_apiClient, userId);
          } catch (_) {
            // Permission loading failure should not prevent the session from being restored
          }
        }
      }

      notifyListeners();
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<bool> tryRefresh() async {
    if (_refreshToken == null) return false;
    try {
      final baseUrl = _determineBaseUrl();
      _ensureApiClient(baseUrl);
      final resp = await _apiClient.post('/api/v1/auth/refresh', body: {
        'refreshToken': _refreshToken,
      });
      if (resp.statusCode == 200) {
        final body = jsonDecode(resp.body) as Map<String, dynamic>;
        _accessToken = body['accessToken'] as String?;
        _expiresAt = DateTime.tryParse(body['expiresAt'] as String? ?? '');
        if (_accessToken != null) {
          await _secureStorage.write(key: 'access_token', value: _accessToken!);
        }
        if (_expiresAt != null) {
          await _secureStorage.write(
            key: 'expires_at',
            value: _expiresAt!.toIso8601String(),
          );
        }
        notifyListeners();
        return true;
      }
    } catch (_) {
      // ignore
    }
    return false;
  }

  Future<void> logout() async {
    try {
      if (_accessToken != null) {
        final baseUrl = _determineBaseUrl();
        _ensureApiClient(baseUrl);
        await _apiClient.post('/api/v1/auth/logout');
      }
    } catch (_) {
      // ignore
    }

    _accessToken = null;
    _refreshToken = null;
    _expiresAt = null;
    currentUser = null;
    currentTenantId = null;
    currentOrganizationId = null;
    currentLocationId = null;
    selectedOrganizationId = null;
    selectedLocationId = null;
    availableOrganizations = const [];
    availableLocations = const [];
    requiresOrganizationSelection = false;
    requiresLocationSelection = false;

    await _secureStorage.delete(key: 'access_token');
    await _secureStorage.delete(key: 'refresh_token');
    await _secureStorage.delete(key: 'expires_at');
    await _secureStorage.delete(key: 'tenant_id');
    await _secureStorage.delete(key: 'organization_id');
    await _secureStorage.delete(key: 'location_id');

    // Clear authorization state
    try {
      authzService.clear();
    } catch (_) {
      // ignore
    }

    notifyListeners();
  }

  Future<bool> loadMe(String baseUrl) async {
    if (_accessToken == null) return false;
    try {
      _ensureApiClient(baseUrl);
      final resp = await _apiClient.get('/api/v1/auth/me');
      if (resp.statusCode == 200) {
        final body = jsonDecode(resp.body) as Map<String, dynamic>;
        currentUser = body['user'] as Map<String, dynamic>?;
        final userTenantId = (currentUser?['tenantId'] ?? '').toString().trim();
        if (userTenantId.isNotEmpty) {
          currentTenantId = userTenantId;
          await _secureStorage.write(key: 'tenant_id', value: userTenantId);
        }
        final userLocationId = (currentUser?['activeLocationId'] ?? '').toString().trim();
        if (userLocationId.isNotEmpty) {
          currentLocationId = userLocationId;
          selectedLocationId = userLocationId;
          await _secureStorage.write(key: 'location_id', value: userLocationId);
        }
        notifyListeners();
        return true;
      }
    } catch (_) {
      // ignore
    }
    return false;
  }

  String _determineBaseUrl() {
    return const String.fromEnvironment(
      'API_BASE_URL',
      defaultValue: 'http://localhost:3000',
    );
  }
}
