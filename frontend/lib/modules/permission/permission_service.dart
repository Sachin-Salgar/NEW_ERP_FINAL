import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:get_it/get_it.dart';

import '../../core/network/api_client.dart';
import '../../core/auth/auth_service.dart';
import 'permission_metadata.dart';

class PermissionService extends ChangeNotifier {
  final ApiClient apiClient;
  final AuthService auth;

  List<String> permissions = [];
  List<PermissionDescriptor> permissionDetails = [];
  bool isLoading = false;
  bool fetchedOnce = false;
  String? error;

  PermissionService({required this.apiClient}) : auth = GetIt.instance.get<AuthService>();

  String labelFor(String permissionKey) =>
      permissionDetails.firstWhere(
        (item) => item.permissionKey == permissionKey,
        orElse: () => PermissionDescriptor.fromJson(permissionKey),
      ).displayName;

  Future<void> fetchPermissions() async {
    isLoading = true;
    error = null;
    notifyListeners();

    try {
      final descriptors = <PermissionDescriptor>[];
      final seenKeys = <String>{};
      var page = 1;
      var totalPages = 1;

      do {
        final resp = await apiClient.get(
          '/api/v1/rbac/permissions?page=$page&page_size=100',
        );
        if (resp.statusCode != 200) {
          error = resp.statusCode == 403
              ? 'Error: Forbidden'
              : 'Error: Failed to load permissions: ${resp.statusCode}';
          permissions = [];
          permissionDetails = const [];
          break;
        }

        final body = jsonDecode(resp.body) as Map<String, dynamic>;
        final list = (body['permissions'] as List<dynamic>?) ?? [];
        for (final descriptor in PermissionDescriptor.normalizePermissions(list)) {
          if (seenKeys.add(descriptor.permissionKey)) {
            descriptors.add(descriptor);
          }
        }

        final metadata = body['metadata'];
        if (metadata is Map<String, dynamic>) {
          final parsedTotalPages = metadata['total_pages'];
          totalPages = parsedTotalPages is num ? parsedTotalPages.toInt() : 1;
        } else {
          totalPages = 1;
        }
        page++;
      } while (page <= totalPages);

      if (error == null) {
        permissionDetails = List<PermissionDescriptor>.unmodifiable(descriptors);
        permissions = permissionDetails.map((item) => item.permissionKey).toList(growable: false);
      }
    } catch (e) {
      error = 'Error: $e';
      permissions = [];
      permissionDetails = const [];
    }

    isLoading = false;
    fetchedOnce = true;
    notifyListeners();
  }
}
