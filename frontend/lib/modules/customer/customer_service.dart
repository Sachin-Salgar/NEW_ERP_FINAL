import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../../core/auth/auth_service.dart';
import '../../core/network/api_client.dart';

class CustomerService extends ChangeNotifier {
  final ApiClient apiClient;
  final AuthService auth;

  List<Map<String, dynamic>> customers = [];
  int page = 1;
  int pageSize = 20;
  int total = 0;
  String search = '';
  bool isLoading = false;
  String? error;

  CustomerService({required this.apiClient, required this.auth});

  int get totalPages => total == 0 ? 1 : (total / pageSize).ceil();

  Future<void> fetchCustomers({String? search, int? page}) async {
    final organizationId = auth.currentOrganizationId;
    if (organizationId == null || organizationId.isEmpty) {
      error = 'Organization context is missing.';
      customers = [];
      notifyListeners();
      return;
    }
    if (search != null) this.search = search;
    if (page != null) this.page = page;
    isLoading = true;
    error = null;
    notifyListeners();
    try {
      final query = <String>[
        'page=${this.page}',
        'page_size=$pageSize',
        'sort=name',
        'order=asc',
        if (this.search.trim().isNotEmpty)
          'search=${Uri.encodeQueryComponent(this.search.trim())}',
      ].join('&');
      final response = await apiClient.get('/api/v1/customers?$query');
      if (response.statusCode != 200) {
        throw Exception(_message(response));
      }
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      final items = (body['customers'] as List<dynamic>?) ?? const [];
      customers = items
          .map((item) => Map<String, dynamic>.from(item as Map))
          .toList();
      final metadata = Map<String, dynamic>.from(
        (body['metadata'] as Map?) ?? const {},
      );
      total = (metadata['total'] as num?)?.toInt() ?? customers.length;
    } catch (e) {
      customers = [];
      error = e.toString().replaceFirst('Exception: ', '');
    } finally {
      isLoading = false;
      notifyListeners();
    }
  }

  Future<Map<String, dynamic>?> getCustomer(String id) async {
    try {
      final response = await apiClient.get('/api/v1/customers/$id');
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body) as Map<String, dynamic>;
        return Map<String, dynamic>.from(body['customer'] as Map);
      }
      error = _message(response);
    } catch (e) {
      error = e.toString().replaceFirst('Exception: ', '');
    }
    return null;
  }

  Future<String?> createCustomer(String name) async {
    final organizationId = auth.currentOrganizationId;
    if (organizationId == null || organizationId.isEmpty) {
      return 'Organization context is missing.';
    }
    try {
      final response = await apiClient.post(
        '/api/v1/customers',
        body: {'organizationId': organizationId, 'name': name.trim()},
      );
      if (response.statusCode == 201) {
        await fetchCustomers();
        return null;
      }
      return _message(response);
    } catch (e) {
      return e.toString().replaceFirst('Exception: ', '');
    }
  }

  Future<Map<String, dynamic>?> updateCustomer(String id, String name) async {
    try {
      final response = await apiClient.patch(
        '/api/v1/customers/$id',
        body: {'name': name.trim()},
      );
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body) as Map<String, dynamic>;
        return Map<String, dynamic>.from(body['customer'] as Map);
      }
      error = _message(response);
    } catch (e) {
      error = e.toString().replaceFirst('Exception: ', '');
    }
    return null;
  }

  Future<String?> deleteCustomer(String id) async {
    try {
      final response = await apiClient.delete('/api/v1/customers/$id');
      if (response.statusCode == 200) return null;
      return _message(response);
    } catch (e) {
      return e.toString().replaceFirst('Exception: ', '');
    }
  }

  String _message(dynamic response) {
    try {
      final body = jsonDecode(response.body);
      if (body is Map<String, dynamic>) {
        final nestedError = body['error'];
        final message = body['message'] ??
            (nestedError is Map ? nestedError['message'] : nestedError);
        if (message is String && message.trim().isNotEmpty) return message;
      }
    } catch (_) {}
    return 'Request failed (HTTP ${response.statusCode}).';
  }
}
