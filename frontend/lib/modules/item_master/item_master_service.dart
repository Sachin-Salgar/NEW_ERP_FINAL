import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../../core/auth/auth_service.dart';
import '../../core/network/api_client.dart';

class ItemMasterService extends ChangeNotifier {
  ItemMasterService({required this.apiClient, required this.auth});

  final ApiClient apiClient;
  final AuthService auth;
  List<Map<String, dynamic>> items = [];
  int page = 1;
  int pageSize = 20;
  int total = 0;
  String search = '';
  bool isLoading = false;
  String? error;

  int get totalPages => total == 0 ? 1 : (total / pageSize).ceil();

  Future<void> fetchItems({String? search, int? page}) async {
    final organizationId = auth.currentOrganizationId;
    if (organizationId == null || organizationId.isEmpty) {
      error = 'Organization context is missing.';
      items = [];
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
      final response = await apiClient.get('/api/v1/inventory/items?$query');
      if (response.statusCode != 200) throw Exception(_message(response));
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      items = ((body['items'] as List<dynamic>?) ?? const [])
          .map((item) => Map<String, dynamic>.from(item as Map))
          .toList();
      final metadata =
          Map<String, dynamic>.from((body['metadata'] as Map?) ?? const {});
      total = (metadata['total'] as num?)?.toInt() ?? items.length;
    } catch (e) {
      items = [];
      error = e.toString().replaceFirst('Exception: ', '');
    } finally {
      isLoading = false;
      notifyListeners();
    }
  }

  Future<String?> createItem({
    required String code,
    required String name,
    required String unitOfMeasure,
    String? description,
    bool salesEligible = true,
  }) async {
    final organizationId = auth.currentOrganizationId;
    if (organizationId == null || organizationId.isEmpty) {
      return 'Organization context is missing.';
    }
    try {
      final response = await apiClient.post(
        '/api/v1/inventory/items',
        body: {
          'organizationId': organizationId,
          'code': code.trim(),
          'name': name.trim(),
          'unitOfMeasure': unitOfMeasure.trim(),
          'description': description?.trim(),
          'salesEligible': salesEligible,
        },
      );
      if (response.statusCode == 201) {
        await fetchItems();
        return null;
      }
      return _message(response);
    } catch (e) {
      return e.toString().replaceFirst('Exception: ', '');
    }
  }

  Future<String?> updateItem(
    String id, {
    required String name,
    required String unitOfMeasure,
    String? description,
    required bool salesEligible,
    required int version,
  }) async {
    try {
      final response = await apiClient.patch(
        '/api/v1/inventory/items/$id',
        body: {
          'name': name.trim(),
          'unitOfMeasure': unitOfMeasure.trim(),
          'description': description?.trim(),
          'salesEligible': salesEligible,
          'expectedVersion': version,
        },
      );
      if (response.statusCode == 200) {
        await fetchItems();
        return null;
      }
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
        final message =
            body['message'] ?? (nestedError is Map ? nestedError['message'] : nestedError);
        if (message is String && message.trim().isNotEmpty) return message;
      }
    } catch (_) {}
    return 'Request failed (HTTP ${response.statusCode}).';
  }
}
