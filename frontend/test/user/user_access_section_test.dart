import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'package:new_erp_final_frontend/core/auth/auth_service.dart';
import 'package:new_erp_final_frontend/core/auth/authz_service.dart';
import 'package:new_erp_final_frontend/core/network/api_client.dart';
import 'package:new_erp_final_frontend/modules/branch/branch_service.dart';
import 'package:new_erp_final_frontend/modules/organization/organization_service.dart';
import 'package:new_erp_final_frontend/modules/user/components/user_access_section.dart';
import 'package:new_erp_final_frontend/modules/user/user_service.dart';

class _MemorySecureStorage implements SecureStorageLike {
  final Map<String, String> _values = {};

  @override
  Future<String?> read({required String key}) async => _values[key];

  @override
  Future<void> write({required String key, required String value}) async {
    _values[key] = value;
  }

  @override
  Future<void> delete({required String key}) async => _values.remove(key);
}

Future<void> _pumpAccess(
  WidgetTester tester,
  MockClient client, {
  ValueChanged<String>? onSummary,
}) async {
  final api = ApiClient(baseUrl: 'http://example.com', httpClient: client);
  GetIt.instance.registerSingleton<ApiClient>(api);
  final authz = AuthZService();
  final auth = AuthService(
    secureStorage: _MemorySecureStorage(),
    apiClientFactory: (_) => api,
    authzService: authz,
  );
  GetIt.instance.registerSingleton<AuthService>(auth);
  await authz.loadPermissions(api, 'admin');
  GetIt.instance.registerSingleton<UserService>(UserService(apiClient: api));
  GetIt.instance.registerSingleton<OrganizationService>(
    OrganizationService(apiClient: api),
  );
  GetIt.instance.registerSingleton<BranchService>(
    BranchService(apiClient: api),
  );

  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: UserAccessSection(
          userId: 'user-1',
          onAccessSummaryChanged: onSummary,
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  setUp(GetIt.instance.reset);
  tearDown(GetIt.instance.reset);

  testWidgets('refreshes the assigned summary after organization assignment', (
    tester,
  ) async {
    var assigned = false;
    var accessReads = 0;
    String? summary;
    final client = MockClient((request) async {
      if (request.url.path.endsWith('/effective-permissions')) {
        return http.Response(
          jsonEncode({'success': true, 'permissions': ['user.manage']}),
          200,
        );
      }
      if (request.url.path == '/api/v1/organizations') {
        return http.Response(
          jsonEncode({
            'organizations': [
              {'id': 'org-new', 'name': 'New Org'},
            ],
          }),
          200,
        );
      }
      if (request.url.path == '/api/v1/users/user-1/access') {
        accessReads++;
        return http.Response(
          jsonEncode({
            'success': true,
            'userId': 'user-1',
            'organizations': assigned
                ? [
                    {'id': 'org-new', 'name': 'New Org'},
                  ]
                : [],
            'branches': [],
          }),
          200,
        );
      }
      if (request.url.path ==
              '/api/v1/users/user-1/organizations/org-new/access' &&
          request.method == 'POST') {
        assigned = true;
        return http.Response(jsonEncode({'success': true}), 200);
      }
      return http.Response('not found', 404);
    });

    await _pumpAccess(tester, client, onSummary: (value) => summary = value);
    expect(summary, 'No organization/branch access');
    expect(accessReads, 1);

    await tester.tap(find.byType(DropdownButtonFormField<String>).first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('New Org'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Assign Organization'));
    await tester.tap(find.text('Assign Organization'));
    await tester.pumpAndSettle();

    expect(accessReads, 2);
    expect(summary, '1 organization • 0 branches');
    expect(find.text('New Org'), findsWidgets);
  });

  testWidgets('shows an access error without claiming selector data is assigned', (
    tester,
  ) async {
    String? summary;
    final client = MockClient((request) async {
      if (request.url.path.endsWith('/effective-permissions')) {
        return http.Response(
          jsonEncode({'success': true, 'permissions': ['user.manage']}),
          200,
        );
      }
      if (request.url.path == '/api/v1/organizations') {
        return http.Response(
          jsonEncode({
            'organizations': [
              {'id': 'org-available', 'name': 'Available Org'},
            ],
          }),
          200,
        );
      }
      if (request.url.path == '/api/v1/users/user-1/access') {
        return http.Response('failed', 500);
      }
      return http.Response('not found', 404);
    });

    await _pumpAccess(tester, client, onSummary: (value) => summary = value);

    expect(summary, 'Unable to load access');
    expect(find.textContaining('Failed to load user access'), findsOneWidget);
    expect(find.text('No organizations assigned'), findsOneWidget);
    expect(find.text('No branches assigned'), findsOneWidget);
  });

  testWidgets('shows assigned access separately from available entities', (
    tester,
  ) async {
    String? summary;
    final client = MockClient((request) async {
      if (request.url.path.endsWith('/effective-permissions')) {
        return http.Response(
          jsonEncode({
            'success': true,
            'permissions': ['user.manage'],
          }),
          200,
        );
      }
      if (request.url.path == '/api/v1/organizations') {
        return http.Response(
          jsonEncode({
            'organizations': [
              {'id': 'org-available', 'name': 'Available Org'},
            ],
          }),
          200,
        );
      }
      if (request.url.path == '/api/v1/users/user-1/access') {
        return http.Response(
          jsonEncode({
            'success': true,
            'userId': 'user-1',
            'organizations': [
              {'id': 'org-assigned', 'name': 'Assigned Org'},
            ],
            'branches': [
              {
                'id': 'branch-assigned',
                'name': 'Assigned Branch',
                'organizationId': 'org-assigned',
                'organizationName': 'Assigned Org',
              },
            ],
          }),
          200,
        );
      }
      return http.Response('not found', 404);
    });

    await _pumpAccess(tester, client, onSummary: (value) => summary = value);

    expect(find.text('Assigned organizations'), findsOneWidget);
    expect(find.text('Assigned Org'), findsOneWidget);
    expect(find.text('Assigned Branch'), findsOneWidget);
    expect(summary, '1 organization • 1 branch');
  });

  testWidgets(
    'reports empty assigned access without using available entities',
    (tester) async {
      String? summary;
      final client = MockClient((request) async {
        if (request.url.path.endsWith('/effective-permissions')) {
          return http.Response(
            jsonEncode({
              'success': true,
              'permissions': ['user.manage'],
            }),
            200,
          );
        }
        if (request.url.path == '/api/v1/organizations') {
          return http.Response(
            jsonEncode({
              'organizations': [
                {'id': 'org-available', 'name': 'Available Org'},
              ],
            }),
            200,
          );
        }
        if (request.url.path == '/api/v1/users/user-1/access') {
          return http.Response(
            jsonEncode({
              'success': true,
              'userId': 'user-1',
              'organizations': [],
              'branches': [],
            }),
            200,
          );
        }
        return http.Response('not found', 404);
      });

      await _pumpAccess(tester, client, onSummary: (value) => summary = value);

      expect(summary, 'No organization/branch access');
      expect(find.text('No organizations assigned'), findsOneWidget);
      expect(find.text('No branches assigned'), findsOneWidget);
    },
  );
}
