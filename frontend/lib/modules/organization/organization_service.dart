import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:get_it/get_it.dart';

import '../../core/network/api_client.dart';
import '../../core/auth/auth_service.dart';

class OrganizationService extends ChangeNotifier {
  final ApiClient apiClient;
  final AuthService auth;

  List<Map<String, dynamic>> organizations = [];
  bool isLoading = false;
  String? error;

  OrganizationService({required this.apiClient})
    : auth = GetIt.instance.get<AuthService>();

  Future<void> fetchOrganizations() async {
    isLoading = true;
    error = null;
    notifyListeners();
    try {
      final resp = await apiClient.get('/api/v1/organizations');
      if (resp.statusCode == 200) {
        final body = jsonDecode(resp.body) as Map<String, dynamic>;
        final list = (body['organizations'] as List<dynamic>?) ?? [];
        organizations = List<Map<String, dynamic>>.from(
          list.map((e) => Map<String, dynamic>.from(e as Map)),
        );
      } else {
        error = 'Failed to load organizations: ${resp.statusCode}';
      }
    } catch (e) {
      error = e.toString();
    }
    isLoading = false;
    notifyListeners();
  }

  Future<bool> createOrganization(Map<String, dynamic> payload) async {
    try {
      final resp = await apiClient.post('/api/v1/organizations', body: payload);
      if (resp.statusCode == 201) {
        await fetchOrganizations();
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  Future<Map<String, dynamic>?> getOrganization(String id) async {
    try {
      final resp = await apiClient.get('/api/v1/organizations/$id');
      if (resp.statusCode == 200) {
        final body = jsonDecode(resp.body) as Map<String, dynamic>;
        return Map<String, dynamic>.from(body['organization'] as Map);
      }
    } catch (e) {
      // ignore
    }
    return null;
  }

  Future<bool> updateOrganization(
    String id,
    Map<String, dynamic> payload,
  ) async {
    try {
      final resp = await apiClient.put(
        '/api/v1/organizations/$id',
        body: payload,
      );
      if (resp.statusCode == 200) {
        await fetchOrganizations();
        return true;
      }
    } catch (e) {
      // ignore
    }
    return false;
  }

  Future<bool> deactivateOrganization(String id) async {
    try {
      final resp = await apiClient.post('/api/v1/organizations/$id/deactivate');
      if (resp.statusCode == 200) {
        await fetchOrganizations();
        return true;
      }
    } catch (e) {}
    return false;
  }
}
