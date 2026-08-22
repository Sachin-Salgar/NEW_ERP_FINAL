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

  /// Create a new role with the given payload. Returns created role map on success or null on failure.
  Future<Map<String, dynamic>?> createRole({required String code, required String name, String? description}) async {
    isLoading = true;
    error = null;
    notifyListeners();

    try {
      final resp = await apiClient.post('/api/v1/rbac/roles', body: {
        'code': code,
        'name': name,
        if (description != null) 'description': description,
      });

      if (resp.statusCode == 200 || resp.statusCode == 201) {
        final body = jsonDecode(resp.body) as Map<String, dynamic>;
        final role = Map<String, dynamic>.from(body['role'] as Map);
        // Optionally refresh list
        await fetchRoles();
        return role;
      }

      if (resp.statusCode == 403) {
        error = 'Forbidden';
        return null;
      }

      // Try to extract validation message from response
      try {
        final body = jsonDecode(resp.body) as Map<String, dynamic>;
        if (body['message'] != null) {
          error = body['message'].toString();
        } else if (body['error'] != null) {
          error = body['error'].toString();
        } else {
          error = 'Failed to create role: ${resp.statusCode}';
        }
      } catch (_) {
        error = 'Failed to create role: ${resp.statusCode}';
      }
    } catch (e) {
      error = e.toString();
    } finally {
      isLoading = false;
      notifyListeners();
    }

    return null;
  }
}
