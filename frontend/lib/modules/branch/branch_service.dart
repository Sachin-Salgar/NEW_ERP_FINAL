import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:get_it/get_it.dart';

import '../../core/network/api_client.dart';
import '../../core/auth/auth_service.dart';

class BranchService extends ChangeNotifier {
  final ApiClient apiClient;
  final AuthService auth;

  List<Map<String, dynamic>> branches = [];
  bool isLoading = false;
  String? error;

  BranchService({required this.apiClient})
    : auth = GetIt.instance.get<AuthService>();

  Future<void> fetchBranches() async {
    isLoading = true;
    error = null;
    notifyListeners();
    try {
      final resp = await apiClient.get('/api/v1/branches');
      if (resp.statusCode == 200) {
        final body = jsonDecode(resp.body) as Map<String, dynamic>;
        final list = (body['branches'] as List<dynamic>?) ?? [];
        branches = List<Map<String, dynamic>>.from(
          list.map((e) => Map<String, dynamic>.from(e as Map)),
        );
      } else {
        error = 'Failed to load branches: ${resp.statusCode}';
      }
    } catch (e) {
      error = e.toString();
    }
    isLoading = false;
    notifyListeners();
  }

  Future<bool> createBranch(Map<String, dynamic> payload) async {
    try {
      final resp = await apiClient.post(
        '/api/v1/branches',
        body: payload,
      );
      if (resp.statusCode == 201) {
        await fetchBranches();
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  Future<Map<String, dynamic>?> getBranch(String branchId) async {
    try {
      final resp = await apiClient.get('/api/v1/branches/$branchId');
      if (resp.statusCode == 200) {
        final body = jsonDecode(resp.body) as Map<String, dynamic>;
        return Map<String, dynamic>.from(body['branch'] as Map);
      }
      if (kDebugMode) {
        debugPrint(
          'ERP branch detail failed: HTTP ${resp.statusCode}; '
          'branchId=$branchId; '
          'body=${resp.body}',
        );
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('ERP branch detail failed: $e');
      }
    }
    return null;
  }

  Future<bool> updateBranch(String branchId, Map<String, dynamic> payload) async {
    try {
      final resp = await apiClient.put(
        '/api/v1/branches/$branchId',
        body: payload,
      );
      if (resp.statusCode == 200) {
        await fetchBranches();
        return true;
      }
    } catch (e) {
      // ignore
    }
    return false;
  }

  Future<bool> deactivateBranch(String branchId) async {
    try {
      final resp = await apiClient.post(
        '/api/v1/branches/$branchId/deactivate',
      );
      if (resp.statusCode == 200) {
        await fetchBranches();
        return true;
      }
    } catch (e) {}
    return false;
  }
}
