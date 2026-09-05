import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../../core/auth/auth_service.dart';
import '../../core/network/api_client.dart';

class InventoryService extends ChangeNotifier {
  InventoryService({required this.apiClient, required this.auth});

  final ApiClient apiClient;
  final AuthService auth;
  List<Map<String, dynamic>> warehouses = [];
  List<Map<String, dynamic>> stock = [];
  List<Map<String, dynamic>> reservations = [];
  bool loading = false;
  String? error;

  Future<void> refresh() async {
    final organizationId = auth.currentOrganizationId;
    if (organizationId == null || organizationId.isEmpty) {
      error = 'Organization context is missing.';
      notifyListeners();
      return;
    }
    loading = true;
    error = null;
    notifyListeners();
    try {
      final responses = await Future.wait([
        apiClient.get('/api/v1/inventory/warehouses?page=1&page_size=100'),
        apiClient.get('/api/v1/inventory/stock?page=1&page_size=100'),
        apiClient.get('/api/v1/inventory/reservations?page=1&page_size=100'),
      ]);
      if (responses.any((response) => response.statusCode != 200)) {
        throw Exception('Inventory data could not be loaded.');
      }
      warehouses = _list(responses[0], 'warehouses');
      stock = _list(responses[1], 'stock');
      reservations = _list(responses[2], 'reservations');
    } catch (e) {
      error = e.toString().replaceFirst('Exception: ', '');
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  Future<String?> createWarehouse(String code, String name) async {
    final response = await apiClient.post('/api/v1/inventory/warehouses', body: {'code': code, 'name': name});
    if (response.statusCode != 201) return _message(response);
    await refresh();
    return null;
  }

  List<Map<String, dynamic>> _list(dynamic response, String key) {
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    return ((body[key] as List<dynamic>?) ?? const [])
        .map((value) => Map<String, dynamic>.from(value as Map))
        .toList();
  }

  String _message(dynamic response) {
    try {
      final body = jsonDecode(response.body);
      if (body is Map && body['message'] is String) return body['message'] as String;
    } catch (_) {}
    return 'Request failed (HTTP ${response.statusCode}).';
  }
}
