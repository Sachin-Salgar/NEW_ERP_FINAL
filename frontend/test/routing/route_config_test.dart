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
      expect(
        AppRoutes.canonicalTopLevel('/organizations/create'),
        '/organizations',
      );
      expect(
        AppRoutes.canonicalTopLevel('/organizations/branches/edit'),
        '/organizations',
      );
      expect(AppRoutes.canonicalTopLevel('/settings/branches'), '/settings');
      expect(AppRoutes.canonicalTopLevel('/settings/users/roles'), '/settings');
      expect(AppRoutes.canonicalTopLevel('/settings/roles/edit'), '/settings');
      expect(
        AppRoutes.canonicalTopLevel('/settings/roles/permissions'),
        '/settings',
      );
    });

    test('uses the same metadata for titles, permissions and modules', () {
      final organizations = AppRoutes.forRoute('/organizations/details');
      expect(organizations.title, 'Organizations');
      expect(organizations.permissionKey, 'organization.read');
      expect(organizations.moduleCode, 'organization');

      final settingsOrganizations = AppRoutes.forRoute(
        '/settings/organizations/create',
      );
      expect(settingsOrganizations.title, 'Organizations');
      expect(settingsOrganizations.permissionKey, 'organization.read');
      expect(settingsOrganizations.moduleCode, 'organization');

      final settingsBranches = AppRoutes.forRoute('/settings/branches');
      expect(settingsBranches.title, 'Branches');
      expect(settingsBranches.permissionKey, 'branch.read');
      expect(settingsBranches.moduleCode, 'branch');

      final settingsUsers = AppRoutes.forRoute('/settings/users/create');
      expect(settingsUsers.title, 'Users');
      expect(settingsUsers.permissionKey, 'user.read');
      expect(settingsUsers.moduleCode, 'user-management');

      final settingsRoles = AppRoutes.forRoute('/settings/roles/create');
      expect(settingsRoles.title, 'Roles');
      expect(settingsRoles.permissionKey, 'role.read');
      expect(settingsRoles.moduleCode, 'security');

      final rolePermissions = AppRoutes.forRoute(
        '/settings/roles/permissions',
      );
      expect(rolePermissions.title, 'Roles');
      expect(rolePermissions.permissionKey, 'role.read');
      expect(rolePermissions.moduleCode, 'security');
      expect(
        AppRoutes.routePermissions['/settings/roles/permissions'],
        'role.manage',
      );

      final settingsPermissions = AppRoutes.forRoute('/settings/permissions');
      expect(settingsPermissions.title, 'Permissions');
      expect(settingsPermissions.permissionKey, 'permission.read');
      expect(settingsPermissions.moduleCode, 'security');

      final dashboard = AppRoutes.forRoute('/dashboard');
      expect(dashboard.permissionKey, isNull);
      expect(dashboard.moduleCode, 'core');
    });

    test('keeps all settings child routes under the settings layout', () {
      expect(AppRoutes.isSettingsRoute('/settings'), isTrue);
      expect(AppRoutes.isSettingsRoute('/settings/organizations'), isTrue);
      expect(
        AppRoutes.isSettingsRoute('/settings/organizations/create'),
        isTrue,
      );
      expect(
        AppRoutes.isSettingsRoute('/settings/organizations/abc/edit'),
        isTrue,
      );
      expect(AppRoutes.isSettingsRoute('/settings/branches/create'), isTrue);
      expect(AppRoutes.isSettingsRoute('/settings/branches/abc/edit'), isTrue);
      expect(AppRoutes.isSettingsRoute('/settings/users'), isTrue);
      expect(AppRoutes.isSettingsRoute('/settings/users/create'), isTrue);
      expect(AppRoutes.isSettingsRoute('/settings/users/123/edit'), isTrue);
      expect(AppRoutes.isSettingsRoute('/settings/users/roles'), isTrue);
      expect(AppRoutes.isSettingsRoute('/settings/users/access'), isTrue);
      expect(AppRoutes.isSettingsRoute('/settings/roles'), isTrue);
      expect(AppRoutes.isSettingsRoute('/settings/roles/create'), isTrue);
      expect(AppRoutes.isSettingsRoute('/settings/roles/edit'), isTrue);
      expect(AppRoutes.isSettingsRoute('/settings/roles/permissions'), isTrue);
      expect(AppRoutes.isSettingsRoute('/settings/permissions'), isTrue);
      expect(
        AppRoutes.isSettingsRoute('/settings/permissions/details'),
        isTrue,
      );
      expect(
        AppRoutes.routePermissions['/settings/roles/permissions'],
        'role.manage',
      );
    });

    test('unknown routes resolve to a safe navigation metadata entry', () {
      expect(
        AppRoutes.forRoute('/not-a-real-route'),
        same(AppRoutes.dashboard),
      );
    });
  });
}
