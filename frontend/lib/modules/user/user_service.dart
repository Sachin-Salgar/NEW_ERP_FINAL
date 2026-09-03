import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:get_it/get_it.dart';

import '../../core/network/api_client.dart';
import '../../core/auth/auth_service.dart';

class UserService extends ChangeNotifier {
  final ApiClient apiClient;
  final AuthService auth;

  List<Map<String, dynamic>> users = [];
  bool isLoading = false;
  String? error;

  UserService({required this.apiClient})
    : auth = GetIt.instance.get<AuthService>();

  Future<void> fetchUsers() async {
    isLoading = true;
    error = null;
    notifyListeners();
    try {
      final resp = await apiClient.get('/api/v1/users');
      if (resp.statusCode == 200) {
        final body = jsonDecode(resp.body) as Map<String, dynamic>;
        final list = (body['users'] as List<dynamic>?) ?? [];
        users = List<Map<String, dynamic>>.from(
          list.map((e) => Map<String, dynamic>.from(e as Map)),
        );
      } else {
        error = 'Failed to load users: ${resp.statusCode}';
      }
    } catch (e) {
      error = e.toString();
    }
    isLoading = false;
    notifyListeners();
  }

  Future<bool> createUser(Map<String, dynamic> payload) async {
    try {
      final resp = await apiClient.post('/api/v1/auth/register', body: payload);
      if (resp.statusCode == 201) {
        await fetchUsers();
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  Future<Map<String, dynamic>?> getUser(String id) async {
    try {
      final resp = await apiClient.get('/api/v1/users/$id');
      if (resp.statusCode == 200) {
        final body = jsonDecode(resp.body) as Map<String, dynamic>;
        return Map<String, dynamic>.from(body['user'] as Map);
      }
    } catch (e) {
      // ignore
    }
    return null;
  }

  Future<bool> updateUser(String id, Map<String, dynamic> payload) async {
    try {
      // The Core API exposes user updates as PATCH /users/:id.
      final resp = await apiClient.patch('/api/v1/users/$id', body: payload);
      if (resp.statusCode == 200) {
        await fetchUsers();
        return true;
      }
    } catch (e) {
      // ignore
    }
    return false;
  }

  Future<bool> activateUser(String id) async {
    try {
      final resp = await apiClient.post('/api/v1/users/$id/activate');
      if (resp.statusCode == 200) {
        await fetchUsers();
        return true;
      }
    } catch (e) {}
    return false;
  }

  Future<bool> deactivateUser(String id) async {
    try {
      final resp = await apiClient.post('/api/v1/users/$id/deactivate');
      if (resp.statusCode == 200) {
        await fetchUsers();
        return true;
      }
    } catch (e) {}
    return false;
  }

  Future<bool> assignOrganizationAccess(
    String userId,
    String organizationId,
  ) async {
    try {
      final resp = await apiClient.post(
        '/api/v1/users/$userId/organizations/$organizationId/access',
      );
      if (resp.statusCode == 200) {
        return true;
      }
    } catch (e) {}
    return false;
  }

  Future<Map<String, List<Map<String, dynamic>>>> getUserAccess(
    String userId,
  ) async {
    final resp = await apiClient.get('/api/v1/users/$userId/access');
    if (resp.statusCode != 200) {
      throw StateError('Failed to load user access: ${resp.statusCode}');
    }

    final body = jsonDecode(resp.body);
    if (body is! Map<String, dynamic> ||
        body['success'] != true ||
        body['userId'] != userId ||
        body['organizations'] is! List<dynamic> ||
        body['branches'] is! List<dynamic>) {
      throw const FormatException('Invalid user access response');
    }

    List<Map<String, dynamic>> parseEntries(
      Object? value,
      String entryType,
    ) {
      final entries = value as List<dynamic>;
      return entries.map((entry) {
        if (entry is! Map) {
          throw FormatException('Invalid $entryType access entry');
        }
        final map = Map<String, dynamic>.from(entry);
        if (map['id'] is! String ||
            map['id'].toString().isEmpty ||
            map['name'] is! String ||
            map['name'].toString().isEmpty) {
          throw FormatException('Invalid $entryType access entry');
        }
        return map;
      }).toList();
    }

    return {
      'organizations': parseEntries(body['organizations'], 'organization'),
      'branches': parseEntries(body['branches'], 'branch'),
    };
  }

  Future<bool> assignRoleToUser(String userId, String roleId) async {
    try {
      final resp = await apiClient.post(
        '/api/v1/rbac/users/$userId/roles',
        body: {'roleId': roleId},
      );
      if (resp.statusCode == 200) {
        final body = jsonDecode(resp.body) as Map<String, dynamic>;
        return (body['assigned'] as bool?) ?? body['success'] == true;
      }
    } catch (e) {}
    return false;
  }

  Future<List<Map<String, dynamic>>> getAssignedRoles(String userId) async {
    final resp = await apiClient.get('/api/v1/rbac/users/$userId/roles');
    if (resp.statusCode != 200) {
      throw StateError('Failed to load assigned roles: ${resp.statusCode}');
    }

    final body = jsonDecode(resp.body);
    if (body is! Map<String, dynamic> ||
        body['success'] is! bool ||
        body['success'] != true ||
        body['userId'] is! String ||
        body['userId'] != userId ||
        body['roles'] is! List<dynamic>) {
      throw const FormatException('Invalid assigned roles response');
    }

    final list = body['roles'] as List<dynamic>;
    return list.map((entry) {
      final roleId = entry is Map ? entry['id'] : null;
      if (entry is! Map || roleId is! String || roleId.isEmpty) {
        throw const FormatException('Invalid assigned role entry');
      }
      return Map<String, dynamic>.from(entry);
    }).toList();
  }

  Future<bool> revokeRoleFromUser(String userId, String roleId) async {
    try {
      final resp = await apiClient.delete(
        '/api/v1/rbac/users/$userId/roles/$roleId',
      );
      if (resp.statusCode == 200) {
        final body = jsonDecode(resp.body) as Map<String, dynamic>;
        return (body['revoked'] as bool?) ?? false;
      }
    } catch (e) {}
    return false;
  }

  Future<bool> assignBranchAccess(String userId, String branchId) async {
    try {
      final resp = await apiClient.post(
        '/api/v1/users/$userId/branches/$branchId/access',
      );
      if (resp.statusCode == 200) {
        return true;
      }
    } catch (e) {}
    return false;
  }
}
