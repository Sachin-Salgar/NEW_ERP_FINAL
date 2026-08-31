import 'package:flutter/material.dart';

/// Canonical metadata for authenticated application navigation.
///
/// The same definitions drive sidebar visibility, route permissions, titles,
/// and route selection. Screen construction remains in [AppRouter].
class AppRouteConfig {
  final String path;
  final String title;
  final String group;
  final String? permissionKey;
  final String? moduleCode;
  final IconData icon;

  const AppRouteConfig({
    required this.path,
    required this.title,
    required this.group,
    required this.permissionKey,
    required this.moduleCode,
    required this.icon,
  });

  bool matches(String route) => route == path || route.startsWith('$path/');
}

class AppRoutes {
  AppRoutes._();

  static const dashboard = AppRouteConfig(
    path: '/dashboard',
    title: 'Dashboard',
    group: 'GENERAL',
    permissionKey: null,
    moduleCode: 'core',
    icon: Icons.dashboard_outlined,
  );
  static const settings = AppRouteConfig(
    path: '/settings',
    title: 'Settings',
    group: 'GENERAL',
    permissionKey: null,
    moduleCode: null,
    icon: Icons.settings_outlined,
  );
  static const organizations = AppRouteConfig(
    path: '/organizations',
    title: 'Organizations',
    group: 'MANAGEMENT',
    permissionKey: 'organization.read',
    moduleCode: 'organization',
    icon: Icons.apartment_outlined,
  );
  static const branches = AppRouteConfig(
    path: '/organizations/branches',
    title: 'Branches',
    group: 'MANAGEMENT',
    permissionKey: 'branch.read',
    moduleCode: 'branch',
    icon: Icons.store_outlined,
  );
  static const settingsOrganizations = AppRouteConfig(
    path: '/settings/organizations',
    title: 'Organizations',
    group: 'SETTINGS',
    permissionKey: 'organization.read',
    moduleCode: 'organization',
    icon: Icons.apartment_outlined,
  );
  static const settingsBranches = AppRouteConfig(
    path: '/settings/branches',
    title: 'Branches',
    group: 'SETTINGS',
    permissionKey: 'branch.read',
    moduleCode: 'branch',
    icon: Icons.store_outlined,
  );
  static const settingsUsers = AppRouteConfig(
    path: '/settings/users',
    title: 'Users',
    group: 'SETTINGS',
    permissionKey: 'user.read',
    moduleCode: 'user-management',
    icon: Icons.people_outline,
  );
  static const settingsRoles = AppRouteConfig(
    path: '/settings/roles',
    title: 'Roles',
    group: 'SETTINGS',
    permissionKey: 'role.read',
    moduleCode: 'security',
    icon: Icons.admin_panel_settings_outlined,
  );
  static const settingsPermissions = AppRouteConfig(
    path: '/settings/permissions',
    title: 'Permissions',
    group: 'SETTINGS',
    permissionKey: 'permission.read',
    moduleCode: 'security',
    icon: Icons.lock_outline,
  );
  static const users = AppRouteConfig(
    path: '/users',
    title: 'Users',
    group: 'MANAGEMENT',
    permissionKey: 'user.read',
    moduleCode: 'user-management',
    icon: Icons.people_outline,
  );
  static const roles = AppRouteConfig(
    path: '/roles',
    title: 'Roles',
    group: 'MANAGEMENT',
    permissionKey: 'role.read',
    moduleCode: 'security',
    icon: Icons.admin_panel_settings_outlined,
  );
  static const permissions = AppRouteConfig(
    path: '/permissions',
    title: 'Permissions',
    group: 'MANAGEMENT',
    permissionKey: 'permission.read',
    moduleCode: 'security',
    icon: Icons.lock_outline,
  );

  static const settingsNavigation = <AppRouteConfig>[
    settingsOrganizations,
    settingsBranches,
    settingsUsers,
    settingsRoles,
    settingsPermissions,
  ];

  static const topLevel = <AppRouteConfig>[dashboard, settings];

  static const routePermissions = <String, String?>{
    '/dashboard': null,
    '/settings': null,
    '/settings/organizations': 'organization.read',
    '/settings/organizations/create': 'organization.manage',
    '/settings/organizations/details': 'organization.read',
    '/settings/organizations/edit': 'organization.manage',
    '/settings/branches': 'branch.read',
    '/settings/branches/create': 'branch.manage',
    '/settings/branches/details': 'branch.read',
    '/settings/branches/edit': 'branch.manage',
    '/settings/users': 'user.read',
    '/settings/users/create': 'user.manage',
    '/settings/users/details': 'user.read',
    '/settings/users/edit': 'user.manage',
    '/settings/users/roles': 'user.manage',
    '/settings/users/access': 'user.manage',
    '/settings/roles': 'role.read',
    '/settings/roles/create': 'role.manage',
    '/settings/roles/permissions': 'role.manage',
    '/settings/roles/edit': 'role.manage',
    '/settings/permissions': 'permission.read',
    '/settings/permissions/details': 'permission.read',
    // Legacy routes are retained for compatibility with existing deep links.
    '/organizations': 'organization.read',
    '/organizations/create': 'organization.manage',
    '/organizations/details': 'organization.read',
    '/organizations/edit': 'organization.manage',
    '/organizations/branches': 'branch.read',
    '/organizations/branches/create': 'branch.manage',
    '/organizations/branches/details': 'branch.read',
    '/organizations/branches/edit': 'branch.manage',
    '/users': 'user.read',
    '/users/create': 'user.manage',
    '/users/details': 'user.read',
    '/users/edit': 'user.manage',
    '/users/roles': 'user.manage',
    '/users/access': 'user.manage',
    '/roles': 'role.read',
    '/roles/create': 'role.manage',
    '/roles/edit': 'role.manage',
    '/permissions': 'permission.read',
  };

  static bool isSettingsRoute(String route) =>
      normalize(route).startsWith('/settings');

  static String normalize(String path) {
    if (path.isEmpty || path == '/') return '/dashboard';
    if (path.endsWith('/') && path.length > 1) {
      return path.substring(0, path.length - 1);
    }
    return path;
  }

  static String canonicalTopLevel(String route) {
    final normalized = normalize(route);
    for (final config in topLevel) {
      if (config.matches(normalized)) return config.path;
    }
    if (isSettingsRoute(normalized)) return settings.path;
    for (final config in [organizations, branches]) {
      if (config.matches(normalized)) return config.path;
    }
    return dashboard.path;
  }

  static AppRouteConfig forRoute(String route) {
    final normalized = normalize(route);
    for (final config in settingsNavigation) {
      if (config.matches(normalized)) return config;
    }
    for (final config in topLevel) {
      if (config.matches(normalized)) return config;
    }
    for (final config in [organizations, branches]) {
      if (config.matches(normalized)) return config;
    }
    return dashboard;
  }
}
