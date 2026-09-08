import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../../core/auth/auth_service.dart';
import '../../core/network/api_client.dart';

/// HTTP client for the purchase bounded context. Payloads intentionally mirror
/// the backend contracts (including optimistic `expectedVersion`).
class PurchaseService extends ChangeNotifier {
  final ApiClient apiClient;
  final AuthService auth;
  bool isLoading = false;
  String? error;
  int pageSize = 20;
  int page = 1;
  final Map<String, int> pages = {
    'suppliers': 1,
    'requisitions': 1,
    'purchaseOrders': 1,
    'receipts': 1,
  };
  final Map<String, bool> loading = {};
  final Map<String, String?> errors = {};
  final Map<String, List<Map<String, dynamic>>> records = {
    'suppliers': [],
    'requisitions': [],
    'purchaseOrders': [],
    'receipts': [],
  };
  final Map<String, int> totals = {};
  PurchaseService({required this.apiClient, required this.auth});

  List<Map<String, dynamic>> get suppliers => records['suppliers']!;
  List<Map<String, dynamic>> get requisitions => records['requisitions']!;
  List<Map<String, dynamic>> get orders => records['purchaseOrders']!;
  List<Map<String, dynamic>> get receipts => records['receipts']!;

  Future<void> load({String? type, int? page}) async {
    if (type != null) {
      if (page != null) pages[type] = page;
      await _loadOne(type);
      return;
    }
    if (page != null) this.page = page;
    if (auth.currentTenantId == null) {
      error = 'Tenant context is missing.';
      notifyListeners();
      return;
    }
    isLoading = true;
    error = null;
    notifyListeners();
    try {
      await Future.wait([
        _list('suppliers', '/api/v1/purchase/suppliers', this.page),
        _list('requisitions', '/api/v1/purchase/requisitions', this.page),
        _list('purchaseOrders', '/api/v1/purchase/purchase-orders', this.page),
        _list('receipts', '/api/v1/purchase/receipts', this.page),
      ]);
    } catch (e) {
      error = e.toString().replaceFirst('Exception: ', '');
    } finally {
      isLoading = false;
      notifyListeners();
    }
  }

  Future<void> _loadOne(String key) async {
    const paths = {
      'suppliers': '/api/v1/purchase/suppliers',
      'requisitions': '/api/v1/purchase/requisitions',
      'purchaseOrders': '/api/v1/purchase/purchase-orders',
      'receipts': '/api/v1/purchase/receipts',
    };
    if (auth.currentTenantId == null) {
      errors[key] = 'Tenant context is missing.';
      notifyListeners();
      return;
    }
    loading[key] = true;
    errors[key] = null;
    notifyListeners();
    try {
      await _list(key, paths[key]!, pages[key]!);
    } catch (e) {
      errors[key] = e.toString().replaceFirst('Exception: ', '');
      rethrow;
    } finally {
      loading[key] = false;
      notifyListeners();
    }
  }

  Future<void> _list(String key, String path, int page) async {
    final r = await apiClient.get('$path?page=$page&page_size=$pageSize');
    if (r.statusCode != 200) throw Exception(_message(r));
    final b = jsonDecode(r.body) as Map<String, dynamic>;
    records[key] = ((b[key] as List?) ?? const [])
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
    totals[key] =
        ((b['metadata'] as Map?)?['total'] as num?)?.toInt() ??
        records[key]!.length;
  }

  int totalPages(String key) =>
      ((totals[key] ?? 0) / pageSize).ceil().clamp(1, 999999);

  Future<Map<String, dynamic>?> get(String type, String id) async {
    final path = {
      'suppliers': 'suppliers',
      'requisitions': 'requisitions',
      'purchaseOrders': 'purchase-orders',
      'receipts': 'receipts',
    }[type]!;
    final r = await apiClient.get('/api/v1/purchase/$path/$id');
    if (r.statusCode != 200) {
      error = _message(r);
      return null;
    }
    final b = jsonDecode(r.body) as Map<String, dynamic>;
    return Map<String, dynamic>.from(
      b[type == 'purchaseOrders'
              ? 'purchaseOrder'
              : type.substring(0, type.length - (type.endsWith('s') ? 1 : 0))]
          as Map,
    );
  }

  Future<String?> create(String type, Map<String, dynamic> body) =>
      _mutate('post', type, body: body);
  Future<String?> update(String type, String id, Map<String, dynamic> body) =>
      _mutate('patch', type, id: id, body: body);
  Future<String?> removeSupplier(String id, int version) => _mutate(
    'delete',
    'suppliers',
    id: id,
    body: {'expectedVersion': version},
  );
  Future<String?> workflow(
    String type,
    String id,
    String status,
    int version, {
    String? action,
  }) => _mutate(
    'post',
    type,
    id: id,
    action: action,
    body: {'status': status, 'expectedVersion': version},
  );

  Future<String?> _mutate(
    String method,
    String type, {
    String? id,
    String? action,
    Map<String, dynamic>? body,
  }) async {
    final path = {
      'suppliers': 'suppliers',
      'requisitions': 'requisitions',
      'purchaseOrders': 'purchase-orders',
      'receipts': 'receipts',
    }[type]!;
    final suffix = action != null ? '/$action' : (id == null ? '' : '/$id');
    try {
      final r = method == 'post'
          ? await apiClient.post(
              '/api/v1/purchase/$path$suffix',
              body: body ?? {},
            )
          : method == 'patch'
          ? await apiClient.patch(
              '/api/v1/purchase/$path$suffix',
              body: body ?? {},
            )
          : await apiClient.delete(
              '/api/v1/purchase/$path$suffix',
              body: body ?? {},
            );
      if (r.statusCode < 200 || r.statusCode >= 300) return _message(r);
      await load(type: type);
      return null;
    } catch (e) {
      return e.toString().replaceFirst('Exception: ', '');
    }
  }

  String _message(dynamic r) {
    try {
      final b = jsonDecode(r.body);
      final e = b is Map ? b['error'] : null;
      final m = b is Map
          ? (b['message'] ?? (e is Map ? e['message'] : e))
          : null;
      if (m is String && m.isNotEmpty) return m;
    } catch (_) {}
    return 'Request failed (HTTP ${r.statusCode}).';
  }
}
