import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../../core/auth/auth_service.dart';
import '../../core/network/api_client.dart';

class SalesService extends ChangeNotifier {
  final ApiClient apiClient;
  final AuthService auth;
  List<Map<String, dynamic>> quotations = [];
  List<Map<String, dynamic>> invoices = [];
  int invoicePage = 1;
  int invoiceTotal = 0;
  int page = 1;
  int pageSize = 20;
  int total = 0;
  String search = '';
  bool isLoading = false;
  String? error;

  SalesService({required this.apiClient, required this.auth});

  int get totalPages => total == 0 ? 1 : (total / pageSize).ceil();
  int get invoiceTotalPages =>
      invoiceTotal == 0 ? 1 : (invoiceTotal / pageSize).ceil();

  Future<void> fetchInvoices({String? search, int? page}) async {
    if (auth.currentOrganizationId == null) {
      error = 'Organization context is missing.';
      invoices = [];
      notifyListeners();
      return;
    }
    if (search != null) this.search = search;
    if (page != null) invoicePage = page;
    isLoading = true;
    error = null;
    notifyListeners();
    try {
      final query = <String>[
        'page=$invoicePage',
        'page_size=$pageSize',
        'order=desc',
        if (this.search.trim().isNotEmpty)
          'search=${Uri.encodeQueryComponent(this.search.trim())}',
      ].join('&');
      final response = await apiClient.get('/api/v1/sales/invoices?$query');
      if (response.statusCode != 200) throw Exception(_message(response));
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      invoices = ((body['invoices'] as List<dynamic>?) ?? const [])
          .map((item) => Map<String, dynamic>.from(item as Map))
          .toList();
      final metadata = Map<String, dynamic>.from(
        (body['metadata'] as Map?) ?? const {},
      );
      invoiceTotal = (metadata['total'] as num?)?.toInt() ?? invoices.length;
    } catch (e) {
      invoices = [];
      error = e.toString().replaceFirst('Exception: ', '');
    } finally {
      isLoading = false;
      notifyListeners();
    }
  }

  Future<Map<String, dynamic>?> getInvoice(String id) async {
    try {
      final response = await apiClient.get('/api/v1/sales/invoices/$id');
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body) as Map<String, dynamic>;
        return Map<String, dynamic>.from(body['invoice'] as Map);
      }
      error = _message(response);
    } catch (e) {
      error = e.toString().replaceFirst('Exception: ', '');
    }
    return null;
  }

  Future<String?> createInvoice(Map<String, dynamic> input) async {
    try {
      final response = await apiClient.post(
        '/api/v1/sales/invoices',
        body: input,
      );
      if (response.statusCode == 201) return null;
      return _message(response);
    } catch (e) {
      return e.toString().replaceFirst('Exception: ', '');
    }
  }

  Future<String?> transitionInvoice(
    String id,
    String action,
    int expectedVersion,
  ) async {
    try {
      final response = await apiClient.post(
        '/api/v1/sales/invoices/$id/$action',
        body: {'expectedVersion': expectedVersion},
      );
      if (response.statusCode == 200) return null;
      return _message(response);
    } catch (e) {
      return e.toString().replaceFirst('Exception: ', '');
    }
  }

  Future<void> fetchQuotations({String? search, int? page}) async {
    if (auth.currentOrganizationId == null) {
      error = 'Organization context is missing.';
      quotations = [];
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
        'sort=quotation_number',
        'order=desc',
        if (this.search.trim().isNotEmpty)
          'search=${Uri.encodeQueryComponent(this.search.trim())}',
      ].join('&');
      final response = await apiClient.get('/api/v1/sales/quotations?$query');
      if (response.statusCode != 200) throw Exception(_message(response));
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      quotations = ((body['quotations'] as List<dynamic>?) ?? const [])
          .map((item) => Map<String, dynamic>.from(item as Map))
          .toList();
      final metadata = Map<String, dynamic>.from(
        (body['metadata'] as Map?) ?? const {},
      );
      total = (metadata['total'] as num?)?.toInt() ?? quotations.length;
    } catch (e) {
      quotations = [];
      error = e.toString().replaceFirst('Exception: ', '');
    } finally {
      isLoading = false;
      notifyListeners();
    }
  }

  Future<Map<String, dynamic>?> getQuotation(String id) async {
    try {
      final response = await apiClient.get('/api/v1/sales/quotations/$id');
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body) as Map<String, dynamic>;
        return Map<String, dynamic>.from(body['quotation'] as Map);
      }
      error = _message(response);
    } catch (e) {
      error = e.toString().replaceFirst('Exception: ', '');
    }
    return null;
  }

  Future<String?> createQuotation(Map<String, dynamic> input) async {
    try {
      final response = await apiClient.post(
        '/api/v1/sales/quotations',
        body: input,
      );
      if (response.statusCode == 201) return null;
      return _message(response);
    } catch (e) {
      return e.toString().replaceFirst('Exception: ', '');
    }
  }

  Future<String?> updateQuotation(String id, Map<String, dynamic> input) async {
    try {
      final response = await apiClient.patch(
        '/api/v1/sales/quotations/$id',
        body: input,
      );
      if (response.statusCode == 200) return null;
      return _message(response);
    } catch (e) {
      return e.toString().replaceFirst('Exception: ', '');
    }
  }

  Future<String?> deleteQuotation(String id) async =>
      _lifecycle(id, '', method: 'delete');

  Future<String?> transition(String id, String action) =>
      _lifecycle(id, action);

  Future<String?> _lifecycle(
    String id,
    String action, {
    String method = 'post',
  }) async {
    try {
      final response = method == 'delete'
          ? await apiClient.delete('/api/v1/sales/quotations/$id')
          : await apiClient.post('/api/v1/sales/quotations/$id/$action');
      if (response.statusCode == 200 || response.statusCode == 204) return null;
      return _message(response);
    } catch (e) {
      return e.toString().replaceFirst('Exception: ', '');
    }
  }

  String _message(dynamic response) {
    try {
      final body = jsonDecode(response.body);
      if (body is Map<String, dynamic>) {
        final nested = body['error'];
        final message =
            body['message'] ?? (nested is Map ? nested['message'] : nested);
        if (message is String && message.trim().isNotEmpty) return message;
      }
    } catch (_) {}
    return 'Request failed (HTTP ${response.statusCode}).';
  }
}
