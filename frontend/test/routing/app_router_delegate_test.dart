import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:new_erp_final_frontend/routing/app_router_delegate.dart';

void main() {
  group('AppRouterDelegate.normalizePath', () {
    test('maps root to dashboard', () {
      expect(AppRouterDelegate.normalizePath('/'), '/dashboard');
      expect(AppRouterDelegate.normalizePath(''), '/dashboard');
    });

    test('remaps legacy routes to the canonical settings location', () {
      expect(AppRouterDelegate.normalizePath('/organizations/'), '/settings/organizations');
      expect(AppRouterDelegate.normalizePath('/roles/'), '/settings/roles');
    });
  });

  test('route information parser uses the URL path', () async {
    final parser = AppRouteInformationParser();

    expect(
      await parser.parseRouteInformation(
        RouteInformation(uri: Uri(path: '/organizations')),
      ),
      '/settings/organizations',
    );
    expect(
      await parser.parseRouteInformation(
        RouteInformation(uri: Uri(path: '/')),
      ),
      '/dashboard',
    );
  });
}
