import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../network/api_client.dart';

class AuthZService with ChangeNotifier {
  List<String>? _permissions;
  bool _isLoading = false;
  String? _loadedForUserId;
  String? _loadingUserId;
  final Map<String, Future<List<String>>> _pendingLoads = {};

  bool get isLoading => _isLoading;
  bool get isLoaded => _permissions != null && _loadedForUserId != null;
  String? get loadedForUserId => _loadedForUserId;

  /// Load effective permissions for [userId].
  ///
  /// An existing authorization snapshot is deliberately retained while a
  /// refresh is in flight. This prevents route transitions from temporarily
  /// looking unauthorized while the same user's effective permissions are
  /// being refreshed.
  Future<List<String>> loadPermissions(ApiClient apiClient, String userId, {bool force = false}) async {
    final existingPending = _pendingLoads[userId];
    if (!force && existingPending != null) {
      return existingPending;
    }

    if (!force && _loadedForUserId == userId && _permissions != null) {
      return List<String>.from(_permissions!);
    }

    final previousPermissions = _permissions;
    final previousUserId = _loadedForUserId;
    _loadingUserId = userId;
    _isLoading = true;
    notifyListeners();

    final future = _loadPermissionsCore(apiClient, userId, previousPermissions, previousUserId)
        .whenComplete(() {
          if (_loadingUserId == userId) {
            _loadingUserId = null;
          }
          _pendingLoads.remove(userId);
          _isLoading = false;
          notifyListeners();
        });

    _pendingLoads[userId] = future;
    return future;
  }

  Future<List<String>> _loadPermissionsCore(
    ApiClient apiClient,
    String userId,
    List<String>? previousPermissions,
    String? previousUserId,
  ) async {
    try {
      final resp = await apiClient.get('/api/v1/rbac/users/$userId/effective-permissions');
      if (resp.statusCode != 200) {
        if (previousUserId != userId) {
          _permissions = null;
          _loadedForUserId = null;
        }
        return List<String>.from(_permissions ?? const <String>[]);
      }

      final body = jsonDecode(resp.body) as Map<String, dynamic>;
      final perms = (body['permissions'] as List<dynamic>?) ?? [];
      final normalized = <String>[];
      for (final item in perms) {
        if (item is String) {
          if (item.isNotEmpty) normalized.add(item);
        } else if (item is Map<String, dynamic>) {
          final key = item['permissionKey']?.toString();
          if (key != null && key.isNotEmpty) normalized.add(key);
        }
      }

      _permissions = normalized;
      _loadedForUserId = userId;
      return List<String>.from(normalized);
    } catch (_) {
      if (previousUserId != userId) {
        _permissions = null;
        _loadedForUserId = null;
      } else if (previousPermissions != null) {
        _permissions = previousPermissions;
        _loadedForUserId = previousUserId;
      }
      return List<String>.from(_permissions ?? const <String>[]);
    }
  }

  bool hasPermission(String permissionKey) {
    if (_permissions == null) return false;
    return _permissions!.contains(permissionKey);
  }

  bool hasAnyPermission(List<String> permissionKeys) {
    if (_permissions == null) return false;
    final set = Set<String>.from(_permissions!);
    return permissionKeys.any((p) => set.contains(p));
  }

  List<String> getPermissionKeys() => List<String>.from(_permissions ?? []);

  Future<List<String>> refresh(ApiClient apiClient) async {
    if (_loadedForUserId == null) return [];
    return loadPermissions(apiClient, _loadedForUserId!, force: true);
  }

  void clear() {
    _permissions = null;
    _loadedForUserId = null;
    _loadingUserId = null;
    _pendingLoads.clear();
    _isLoading = false;
    notifyListeners();
  }
}
