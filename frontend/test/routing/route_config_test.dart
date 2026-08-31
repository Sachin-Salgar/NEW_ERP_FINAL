import 'package:flutter_test/flutter_test.dart';
import 'package:new_erp_final_frontend/routing/route_config.dart';

void main() {
  group('AppRoutes', () {
    test('normalizes root and trailing slash', () {
      expect(AppRoutes.normalize('/'), '/dashboard');
      expect(AppRoutes.normalize(''), '/dashboard');
      expect(AppRoutes.normalize('/organizations/'), '/organizations');
    });

    test('maps child routes to their top-level navigation item', () {
      expect(AppRoutes.canonicalTopLevel('/organizations/create'), '/organizations');
      expect(AppRoutes.canonicalTopLevel('/organizations/branches/edit'), '/organizations');
      expect(AppRoutes.canonicalTopLevel('/settings/branches'), '/settings');
      expect(AppRoutes.canonicalTopLevel('/users/roles'), '/users');
      expect(AppRoutes.canonicalTopLevel('/roles/edit'), '/roles');
    });

    test('uses the same metadata for titles, permissions and modules', () {
      final organizations = AppRoutes.forRoute('/organizations/details');
      expect(organizations.title, 'Organizations');
      expect(organizations.permissionKey, 'organization.read');
      expect(organizations.moduleCode, 'organization');

      final settingsOrganizations = AppRoutes.forRoute('/settings/organizations/create');
      expect(settingsOrganizations.title, 'Organizations');
      expect(settingsOrganizations.permissionKey, 'organization.read');
      expect(settingsOrganizations.moduleCode, 'organization');

      final settingsBranches = AppRoutes.forRoute('/settings/branches');
      expect(settingsBranches.title, 'Branches');
      expect(settingsBranches.permissionKey, 'branch.read');
      expect(settingsBranches.moduleCode, 'branch');

      final dashboard = AppRoutes.forRoute('/dashboard');
      expect(dashboard.permissionKey, isNull);
      expect(dashboard.moduleCode, 'core');
    });

    test('keeps all settings child routes under the settings layout', () {
      expect(AppRoutes.isSettingsRoute('/settings'), isTrue);
      expect(AppRoutes.isSettingsRoute('/settings/organizations'), isTrue);
      expect(AppRoutes.isSettingsRoute('/settings/organizations/create'), isTrue);
      expect(AppRoutes.isSettingsRoute('/settings/organizations/abc/edit'), isTrue);
      expect(AppRoutes.isSettingsRoute('/settings/branches/create'), isTrue);
      expect(AppRoutes.isSettingsRoute('/settings/branches/abc/edit'), isTrue);
    });

    test('unknown routes resolve to a safe navigation metadata entry', () {
      expect(AppRoutes.forRoute('/not-a-real-route'), same(AppRoutes.dashboard));
    });
  });
}
