import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:new_erp_final_frontend/routing/app_router_delegate.dart';

void main() {
  test('parser normalizes root and trailing slashes', () async {
    final parser = AppRouteInformationParser();
    expect(
      await parser.parseRouteInformation(
        RouteInformation(uri: Uri.parse('/')),
      ),
      '/dashboard',
    );
    expect(
      await parser.parseRouteInformation(
        RouteInformation(uri: Uri.parse('/organizations/')),
      ),
      '/settings/organizations',
    );
  });

  test('serializer emits the canonical browser path', () {
    final parser = AppRouteInformationParser();
    expect(parser.restoreRouteInformation('/').uri.path, '/dashboard');
    expect(
      parser.restoreRouteInformation('/organizations').uri.path,
      '/settings/organizations',
    );
  });
}
