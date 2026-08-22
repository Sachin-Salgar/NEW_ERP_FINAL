import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:get_it/get_it.dart';

import '../../core/network/api_client.dart';
import '../../core/auth/auth_service.dart';

class RoleService extends ChangeNotifier {
  final ApiClient apiClient;
  final AuthService auth;

  List<Map<String, dynamic>> roles = [];
  bool isLoading = false;
  bool fetchedOnce = false;
  String? error;

  RoleService({required this.apiClient}) : auth = GetIt.instance.get<AuthService>();

  Future<void> fetchRoles() async {
    isLoading = true;
    error = null;
    notifyListeners();

    try {
      final resp = await apiClient.get('/api/v1/rbac/roles');
      if (resp.statusCode == 200) {
        final body = jsonDecode(resp.body) as Map<String, dynamic>;
        final list = (body['roles'] as List<dynamic>?) ?? [];
        roles = List<Map<String, dynamic>>.from(
          list.map((e) => Map<String, dynamic>.from(e as Map)),
        );
      } else if (resp.statusCode == 403) {
        error = 'Forbidden';
        roles = [];
      } else {
        error = 'Failed to load roles: ${resp.statusCode}';
      }
    } catch (e) {
      error = e.toString();
    }

    isLoading = false;
    fetchedOnce = true;
    notifyListeners();
  }
}
