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
        error = 'Error: Forbidden';
        roles = [];
      } else {
        error = 'Error: Failed to load roles: ${resp.statusCode}';
      }
    } catch (e) {
      error = 'Error: $e';
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

  /// Fetch a single role by id
  Future<Map<String, dynamic>?> getRole(String roleId) async {
    isLoading = true;
    error = null;
    notifyListeners();

    try {
      final resp = await apiClient.get('/api/v1/rbac/roles/$roleId');
      if (resp.statusCode == 200) {
        final body = jsonDecode(resp.body) as Map<String, dynamic>;
        final role = Map<String, dynamic>.from(body['role'] as Map);
        return role;
      }

      if (resp.statusCode == 403) {
        error = 'Forbidden';
        return null;
      }

      error = 'Failed to load role: ${resp.statusCode}';
    } catch (e) {
      error = e.toString();
    } finally {
      isLoading = false;
      notifyListeners();
    }

    return null;
  }

  /// Update an existing role. Returns updated role on success, null on failure.
  Future<Map<String, dynamic>?> updateRole({required String roleId, String? code, String? name, String? description, bool? isSystem}) async {
    isLoading = true;
    error = null;
    notifyListeners();

    try {
      final body = <String, dynamic>{
        if (code != null) 'code': code,
        if (name != null) 'name': name,
        if (description != null) 'description': description,
        if (isSystem != null) 'isSystem': isSystem,
      };

      final resp = await apiClient.patch('/api/v1/rbac/roles/$roleId', body: body);

      if (resp.statusCode == 200) {
        final respBody = jsonDecode(resp.body) as Map<String, dynamic>;
        final role = Map<String, dynamic>.from(respBody['role'] as Map);
        // Refresh local list to reflect update
        await fetchRoles();
        return role;
      }

      if (resp.statusCode == 403) {
        error = 'Forbidden';
        return null;
      }

      try {
        final respBody = jsonDecode(resp.body) as Map<String, dynamic>;
        if (respBody['message'] != null) {
          error = respBody['message'].toString();
        } else if (respBody['error'] != null) {
          error = respBody['error'].toString();
        } else {
          error = 'Failed to update role: ${resp.statusCode}';
        }
      } catch (_) {
        error = 'Failed to update role: ${resp.statusCode}';
      }
    } catch (e) {
      error = e.toString();
    } finally {
      isLoading = false;
      notifyListeners();
    }

    return null;
  }

  /// Fetch permissions assigned to a role
  Future<List<Map<String, dynamic>>> getRolePermissions(String roleId) async {
    isLoading = true;
    error = null;
    notifyListeners();

    try {
      final resp = await apiClient.get('/api/v1/rbac/roles/$roleId/permissions');
      if (resp.statusCode == 200) {
        final body = jsonDecode(resp.body) as Map<String, dynamic>;
        final list = (body['permissions'] as List<dynamic>?) ?? [];
        return List<Map<String, dynamic>>.from(list.map((e) => Map<String, dynamic>.from(e as Map)));
      }

      if (resp.statusCode == 403) {
        error = 'Forbidden';
        return [];
      }

      error = 'Failed to load role permissions: ${resp.statusCode}';
    } catch (e) {
      error = e.toString();
    } finally {
      isLoading = false;
      notifyListeners();
    }

    return [];
  }

  /// Assign permission(s) to a role. Returns number assigned on success or 0 on failure.
  Future<int> assignPermissionsToRole(String roleId, List<String> permissionKeys) async {
    isLoading = true;
    error = null;
    notifyListeners();

    try {
      final resp = await apiClient.post('/api/v1/rbac/roles/$roleId/permissions', body: {'permissionKeys': permissionKeys});
      if (resp.statusCode == 200) {
        final body = jsonDecode(resp.body) as Map<String, dynamic>;
        final assigned = body['assigned'] as int? ?? 0;
        return assigned;
      }

      if (resp.statusCode == 403) {
        error = 'Forbidden';
        return 0;
      }

      try {
        final body = jsonDecode(resp.body) as Map<String, dynamic>;
        error = body['message']?.toString() ?? body['error']?.toString() ?? 'Failed to assign permission: ${resp.statusCode}';
      } catch (_) {
        error = 'Failed to assign permission: ${resp.statusCode}';
      }
    } catch (e) {
      error = e.toString();
    } finally {
      isLoading = false;
      notifyListeners();
    }

    return 0;
  }

  /// Remove permission(s) from a role. Returns number removed on success or 0 on failure.
  Future<int> removePermissionsFromRole(String roleId, List<String> permissionKeys) async {
    isLoading = true;
    error = null;
    notifyListeners();

    try {
      final resp = await apiClient.delete('/api/v1/rbac/roles/$roleId/permissions', body: {'permissionKeys': permissionKeys});
      if (resp.statusCode == 200) {
        final body = jsonDecode(resp.body) as Map<String, dynamic>;
        final removed = body['removed'] as int? ?? 0;
        return removed;
      }

      if (resp.statusCode == 403) {
        error = 'Forbidden';
        return 0;
      }

      try {
        final body = jsonDecode(resp.body) as Map<String, dynamic>;
        error = body['message']?.toString() ?? body['error']?.toString() ?? 'Failed to remove permission: ${resp.statusCode}';
      } catch (_) {
        error = 'Failed to remove permission: ${resp.statusCode}';
      }
    } catch (e) {
      error = e.toString();
    } finally {
      isLoading = false;
      notifyListeners();
    }

    return 0;
  }
}
