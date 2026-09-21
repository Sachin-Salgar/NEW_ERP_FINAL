// dart format off
import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../../core/auth/auth_service.dart';
import '../../core/network/api_client.dart';

class HrService extends ChangeNotifier {
  final ApiClient apiClient;
  final AuthService auth;

  HrService({required this.apiClient, required this.auth});

  bool loading = false;
  String? error;
  List<Map<String, dynamic>> employees = [];

  Future<void> loadEmployees() async {
    loading = true;
    error = null;
    notifyListeners();
    try {
      final response =
          await apiClient.get('/api/v1/hr/employees?page=1&page_size=100');
      if (response.statusCode != 200) {
        throw Exception(response.body);
      }
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      employees = ((body['items'] as List?) ?? const [])
          .map((item) => Map<String, dynamic>.from(item as Map))
          .toList();
    } catch (e) {
      error = e.toString();
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  Future<Map<String, dynamic>> createEmployee(
    Map<String, dynamic> body,
  ) async {
    final response =
        await apiClient.post('/api/v1/hr/employees', body: body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(response.body);
    }
    await loadEmployees();
    return Map<String, dynamic>.from(
      (jsonDecode(response.body) as Map<String, dynamic>)['record'] as Map,
    );
  }

  Future<Map<String, dynamic>> create(
    String resource,
    Map<String, dynamic> body,
  ) async {
    final response =
        await apiClient.post('/api/v1/hr/$resource', body: body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(response.body);
    }
    return Map<String, dynamic>.from(
      (jsonDecode(response.body) as Map<String, dynamic>)['record'] as Map,
    );
  }

  Future<void> punch(String employeeId, bool checkIn) async {
    final suffix = checkIn ? '/check-in' : '/check-out';
    final response = await apiClient.post(
      '/api/v1/hr/attendance/$employeeId$suffix',
      body: const {},
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(response.body);
    }
  }
  Future<List<Map<String, dynamic>>> listResource(String resource) async {
    final response =
        await apiClient.get('/api/v1/hr/$resource?page=1&page_size=100');
    if (response.statusCode != 200) {
      throw Exception(response.body);
    }
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    return ((body['items'] as List?) ?? const [])
        .map((item) => Map<String, dynamic>.from(item as Map))
        .toList();
  }

  Future<Map<String, dynamic>> workforceSummary() async {
    final response = await apiClient.get('/api/v1/hr/analytics/workforce');
    if (response.statusCode != 200) {
      throw Exception(response.body);
    }
    return Map<String, dynamic>.from(jsonDecode(response.body) as Map);
  }
}

