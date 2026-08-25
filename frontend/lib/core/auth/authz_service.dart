import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../network/api_client.dart';

class AuthZService with ChangeNotifier {
  List<String>? _permissions;
  bool _isLoading = false;
  String? _loadedForUserId;

  bool get isLoading => _isLoading;
  bool get isLoaded => _permissions != null && _loadedForUserId != null;
  String? get loadedForUserId => _loadedForUserId;

  /// Load effective permissions for [userId] using the provided [apiClient].
  /// Returns the permission keys on success.
  Future<List<String>> loadPermissions(ApiClient apiClient, String userId) async {
    _isLoading = true;
    // Clear any stale permission set before a fresh load or refresh so the UI never
    // keeps permissions from a previous user or prior fetch while the new request is in flight.
    _permissions = null;
    _loadedForUserId = null;
    notifyListeners();

    try {
      final resp = await apiClient.get('/api/v1/rbac/users/$userId/effective-permissions');
      if (resp.statusCode != 200) {
        // Do not grant permissions on failure.
        _permissions = null;
        _loadedForUserId = null;
        return [];
      }

      final body = jsonDecode(resp.body) as Map<String, dynamic>;
      final perms = (body['permissions'] as List<dynamic>?) ?? [];
      _permissions = perms.map((e) => e.toString()).toList();
      _loadedForUserId = userId;
      return _permissions!;
    } catch (_) {
      _permissions = null;
      _loadedForUserId = null;
      return [];
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Returns true if the permission is present for the currently loaded user.
  /// If permissions are not loaded, returns false. The UI may listen to isLoading/isLoaded
  /// to show placeholders while permissions are being fetched.
  bool hasPermission(String permissionKey) {
    if (_permissions == null) return false;
    return _permissions!.contains(permissionKey);
  }

  /// Returns true if any permission from [permissionKeys] is present.
  bool hasAnyPermission(List<String> permissionKeys) {
    if (_permissions == null) return false;
    final set = Set<String>.from(_permissions!);
    return permissionKeys.any((p) => set.contains(p));
  }

  /// Returns a copy of the loaded permission keys, or an empty list if none loaded.
  List<String> getPermissionKeys() => List<String>.from(_permissions ?? []);

  /// Explicitly refresh permissions for the currently loaded user.
  Future<List<String>> refresh(ApiClient apiClient) async {
    if (_loadedForUserId == null) return [];
    return loadPermissions(apiClient, _loadedForUserId!);
  }

  /// Clear loaded permissions (for logout/session change).
  void clear() {
    _permissions = null;
    _loadedForUserId = null;
    _isLoading = false;
    notifyListeners();
  }
}
