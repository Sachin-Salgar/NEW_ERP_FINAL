import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../network/api_client.dart';

class AuthZService with ChangeNotifier {
  List<String>? _permissions;
  List<Map<String, dynamic>> _modules = const [];
  bool _isLoading = false;
  String? _loadedForUserId;

  bool get isLoading => _isLoading;
  bool get isLoaded => _permissions != null && _loadedForUserId != null;
  String? get loadedForUserId => _loadedForUserId;
  List<Map<String, dynamic>> get modules => List<Map<String, dynamic>>.from(_modules);

  Future<List<String>> loadPermissions(ApiClient apiClient, String userId) async {
    _isLoading = true;
    _permissions = null;
    _modules = const [];
    _loadedForUserId = null;
    notifyListeners();

    try {
      final resp = await apiClient.get('/api/v1/auth/effective-permissions');
      if (resp.statusCode != 200) {
        _permissions = null;
        _modules = const [];
        _loadedForUserId = null;
        return [];
      }

      final body = jsonDecode(resp.body) as Map<String, dynamic>;
      final perms = (body['permissions'] as List<dynamic>?) ?? [];
      final modules = (body['modules'] as List<dynamic>?) ?? [];
      _permissions = perms.map((e) => e.toString()).toList();
      _modules = modules.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      _loadedForUserId = userId;
      return _permissions!;
    } catch (_) {
      _permissions = null;
      _modules = const [];
      _loadedForUserId = null;
      return [];
    } finally {
      _isLoading = false;
      notifyListeners();
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

  bool hasModule(String moduleCode) {
    return _modules.any((module) => module['code']?.toString() == moduleCode);
  }

  List<String> getPermissionKeys() => List<String>.from(_permissions ?? []);

  Future<List<String>> refresh(ApiClient apiClient) async {
    if (_loadedForUserId == null) return [];
    return loadPermissions(apiClient, _loadedForUserId!);
  }

  void clear() {
    _permissions = null;
    _modules = const [];
    _loadedForUserId = null;
    _isLoading = false;
    notifyListeners();
  }
}