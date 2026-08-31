import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:get_it/get_it.dart';

import '../../core/network/api_client.dart';
import '../../core/auth/auth_service.dart';
import 'permission_metadata.dart';

class PermissionService extends ChangeNotifier {
  final ApiClient apiClient;
  final AuthService auth;

  List<String> permissions = [];
  List<PermissionDescriptor> permissionDetails = [];
  bool isLoading = false;
  bool fetchedOnce = false;
  String? error;

  PermissionService({required this.apiClient}) : auth = GetIt.instance.get<AuthService>();

  String labelFor(String permissionKey) =>
      permissionDetails.firstWhere(
        (item) => item.permissionKey == permissionKey,
        orElse: () => PermissionDescriptor.fromJson(permissionKey),
      ).displayName;

  Future<void> fetchPermissions() async {
    isLoading = true;
    error = null;
    notifyListeners();

    try {
      final resp = await apiClient.get('/api/v1/rbac/permissions');
      if (resp.statusCode == 200) {
        final body = jsonDecode(resp.body) as Map<String, dynamic>;
        final list = (body['permissions'] as List<dynamic>?) ?? [];
        permissionDetails = PermissionDescriptor.normalizePermissions(list);
        permissions = permissionDetails.map((item) => item.permissionKey).toList(growable: false);
      } else if (resp.statusCode == 403) {
        error = 'Error: Forbidden';
        permissions = [];
        permissionDetails = const [];
      } else {
        error = 'Error: Failed to load permissions: ${resp.statusCode}';
        permissions = [];
        permissionDetails = const [];
      }
    } catch (e) {
      error = 'Error: $e';
      permissions = [];
      permissionDetails = const [];
    }

    isLoading = false;
    fetchedOnce = true;
    notifyListeners();
  }
}
