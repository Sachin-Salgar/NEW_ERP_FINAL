import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:get_it/get_it.dart';

import '../../core/network/api_client.dart';
import '../../core/auth/auth_service.dart';

class PermissionService extends ChangeNotifier {
  final ApiClient apiClient;
  final AuthService auth;

  List<String> permissions = [];
  bool isLoading = false;
  bool fetchedOnce = false;
  String? error;

  PermissionService({required this.apiClient}) : auth = GetIt.instance.get<AuthService>();

  Future<void> fetchPermissions() async {
    isLoading = true;
    error = null;
    notifyListeners();

    try {
      final resp = await apiClient.get('/api/v1/rbac/permissions');
      if (resp.statusCode == 200) {
        final body = jsonDecode(resp.body) as Map<String, dynamic>;
        final list = (body['permissions'] as List<dynamic>?) ?? [];
        permissions = List<String>.from(list.map((e) => e.toString()));
      } else if (resp.statusCode == 403) {
        error = 'Forbidden';
        permissions = [];
      } else {
        error = 'Failed to load permissions: ${resp.statusCode}';
      }
    } catch (e) {
      error = e.toString();
    }

    isLoading = false;
    fetchedOnce = true;
    notifyListeners();
  }
}
