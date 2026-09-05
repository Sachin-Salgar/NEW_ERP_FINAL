import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../../core/auth/auth_service.dart';
import '../../core/network/api_client.dart';

class PurchaseService extends ChangeNotifier {
  final ApiClient apiClient;
  final AuthService auth;

  bool isLoading = false;
  String? error;
  List<Map<String, dynamic>> suppliers = [];
  List<Map<String, dynamic>> requisitions = [];
  List<Map<String, dynamic>> orders = [];
  List<Map<String, dynamic>> receipts = [];

  PurchaseService({required this.apiClient, required this.auth});

  Future<void> load() async {
    if (auth.currentOrganizationId == null) {
      error = 'Organization context is missing.';
      notifyListeners();
      return;
    }
    isLoading = true;
    error = null;
    notifyListeners();
    try {
      final results = await Future.wait([
        apiClient.get('/api/v1/purchase/suppliers?page=1&page_size=20'),
        apiClient.get('/api/v1/purchase/requisitions?page=1&page_size=20'),
        apiClient.get('/api/v1/purchase/orders?page=1&page_size=20'),
        apiClient.get('/api/v1/purchase/receipts?page=1&page_size=20'),
      ]);
      suppliers = _items(results[0], 'suppliers');
      requisitions = _items(results[1], 'requisitions');
      orders = _items(results[2], 'orders');
      receipts = _items(results[3], 'receipts');
    } catch (e) {
      error = e.toString().replaceFirst('Exception: ', '');
    } finally {
      isLoading = false;
      notifyListeners();
    }
  }

  Future<String?> createSupplier({
    required String code,
    required String name,
    String? email,
    String? phone,
  }) async {
    try {
      final response = await apiClient.post('/api/v1/purchase/suppliers', body: {
        'code': code.trim(),
        'name': name.trim(),
        if (email != null && email.trim().isNotEmpty) 'email': email.trim(),
        if (phone != null && phone.trim().isNotEmpty) 'phone': phone.trim(),
      });
      if (response.statusCode != 201) return _message(response);
      await load();
      return null;
    } catch (e) {
      return e.toString().replaceFirst('Exception: ', '');
    }
  }

  List<Map<String, dynamic>> _items(dynamic response, String key) {
    if (response.statusCode != 200) throw Exception(_message(response));
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    return ((body[key] as List<dynamic>?) ?? const [])
        .map((item) => Map<String, dynamic>.from(item as Map))
        .toList();
  }

  String _message(dynamic response) {
    try {
      final body = jsonDecode(response.body);
      if (body is Map<String, dynamic>) {
        final nested = body['error'];
        final message = body['message'] ?? (nested is Map ? nested['message'] : nested);
        if (message is String && message.isNotEmpty) return message;
      }
    } catch (_) {}
    return 'Request failed (HTTP ${response.statusCode}).';
  }
}
