import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'package:new_erp_final_frontend/core/auth/auth_service.dart';
import 'package:new_erp_final_frontend/core/network/api_client.dart';
import 'package:new_erp_final_frontend/modules/auth/context_selection_screen.dart';

void main() {
  tearDown(() async {
    await GetIt.instance.reset();
  });

  testWidgets('displays only server-provided context labels', (tester) async {
    final client = MockClient((request) async {
      if (request.url.path == '/api/v1/auth/login') {
        return http.Response(
          jsonEncode({
            'success': true,
            'resolution': 'SELECT',
            'pendingSelectionToken': 'challenge.secret',
            'contexts': [
              {
                'type': 'tenant',
                'contextRef': 'internal-membership-ref',
                'label': 'Tenant One',
              },
              {
                'type': 'platform',
                'contextRef': 'platform-membership-ref',
                'label': 'Platform administration',
              },
            ],
          }),
          200,
        );
      }
      return http.Response('ok', 200);
    });
    late final AuthService auth;
    auth = AuthService(
      apiClientFactory: (baseUrl) =>
          ApiClient(baseUrl: baseUrl, httpClient: client, authOverride: auth),
    );
    await auth.login('http://example.com', 'user@example.com', 'Password123');
    GetIt.instance.registerSingleton<AuthService>(auth);

    await tester.pumpWidget(const MaterialApp(home: ContextSelectionScreen()));

    expect(find.text('Choose your workspace'), findsOneWidget);
    expect(find.text('Tenant One'), findsOneWidget);
    expect(find.text('Platform administration'), findsOneWidget);
    expect(find.text('internal-membership-ref'), findsNothing);
    expect(find.text('challenge.secret'), findsNothing);
  });
}
