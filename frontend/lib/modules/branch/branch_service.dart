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

  String _resolveOrganizationId([String? providedOrganizationId]) {
    final candidate = (providedOrganizationId ?? auth.currentOrganizationId ?? auth.selectedOrganizationId ?? '')
        .toString()
        .trim();

    if (candidate.isEmpty) {
      throw StateError('Organization context is missing. Please select or restore an active organization before loading branches.');
    }

    return candidate;
  }

  Future<void> fetchBranches([String? organizationId]) async {
    isLoading = true;
    error = null;
    notifyListeners();
    try {
      final resolvedOrganizationId = _resolveOrganizationId(organizationId);
      final resp = await apiClient.get(
        '/api/v1/organizations/$resolvedOrganizationId/branches',
      );
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

  Future<bool> createBranch(
    String? organizationId, [
    Map<String, dynamic>? payload,
  ]) async {
    try {
      final resolvedOrganizationId = _resolveOrganizationId(organizationId);
      final resolvedPayload = payload ?? const <String, dynamic>{};
      final resp = await apiClient.post(
        '/api/v1/organizations/$resolvedOrganizationId/branches',
        body: resolvedPayload,
      );
      if (resp.statusCode == 201) {
        await fetchBranches(resolvedOrganizationId);
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  Future<Map<String, dynamic>?> getBranch(
    String? organizationId,
    String branchId,
  ) async {
    try {
      final resolvedOrganizationId = _resolveOrganizationId(organizationId);
      final resp = await apiClient.get(
        '/api/v1/organizations/$resolvedOrganizationId/branches/$branchId',
      );
      if (resp.statusCode == 200) {
        final body = jsonDecode(resp.body) as Map<String, dynamic>;
        return Map<String, dynamic>.from(body['branch'] as Map);
      }
    } catch (e) {
      // ignore
    }
    return null;
  }

  Future<bool> updateBranch(
    String? organizationId,
    String branchId,
    Map<String, dynamic> payload,
  ) async {
    try {
      final resolvedOrganizationId = _resolveOrganizationId(organizationId);
      final resp = await apiClient.put(
        '/api/v1/organizations/$resolvedOrganizationId/branches/$branchId',
        body: payload,
      );
      if (resp.statusCode == 200) {
        await fetchBranches(resolvedOrganizationId);
        return true;
      }
    } catch (e) {
      // ignore
    }
    return false;
  }

  Future<bool> deactivateBranch(String? organizationId, String branchId) async {
    try {
      final resolvedOrganizationId = _resolveOrganizationId(organizationId);
      final resp = await apiClient.post(
        '/api/v1/organizations/$resolvedOrganizationId/branches/$branchId/deactivate',
      );
      if (resp.statusCode == 200) {
        await fetchBranches(resolvedOrganizationId);
        return true;
      }
    } catch (e) {}
    return false;
  }
}
