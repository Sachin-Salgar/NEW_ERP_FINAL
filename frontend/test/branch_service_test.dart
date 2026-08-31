import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:http/http.dart' as http;
import 'package:new_erp_final_frontend/core/auth/auth_service.dart';
import 'package:new_erp_final_frontend/core/auth/authz_service.dart';
import 'package:new_erp_final_frontend/core/network/api_client.dart';
import 'package:new_erp_final_frontend/modules/branch/branch_service.dart';

class RecordingApiClient extends ApiClient {
  String? lastPath;

  RecordingApiClient() : super(baseUrl: 'http://localhost:3000');

  @override
  Future<http.Response> get(String path) async {
    lastPath = path;
    return http.Response(jsonEncode({'branches': []}), 200);
  }
}

void main() {
  setUp(() {
    GetIt.instance.reset();
  });

  tearDown(() {
    GetIt.instance.reset();
  });

  test('uses the authenticated organization id when the branch route is missing an org id', () async {
    final auth = AuthService(authzService: AuthZService());
    auth.currentOrganizationId = 'org-123';
    GetIt.instance.registerSingleton<AuthService>(auth);

    final api = RecordingApiClient();
    final service = BranchService(apiClient: api);

    await service.fetchBranches('');

    expect(api.lastPath, '/api/v1/organizations/org-123/branches');
    expect(service.error, isNull);
  });

  test('fails explicitly instead of creating an empty organization path', () async {
    final auth = AuthService(authzService: AuthZService());
    auth.currentOrganizationId = null;
    GetIt.instance.registerSingleton<AuthService>(auth);

    final api = RecordingApiClient();
    final service = BranchService(apiClient: api);

    await service.fetchBranches('');

    expect(api.lastPath, isNull);
    expect(service.error, contains('Organization context is missing'));
  });
}
