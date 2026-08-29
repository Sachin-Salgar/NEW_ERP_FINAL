import 'package:flutter/material.dart';

/// Canonical metadata for authenticated application navigation.
///
/// The same definitions drive sidebar visibility, route permissions, titles,
/// and route selection. Screen construction remains in [AppRouter] so this
/// model stays presentation/routing metadata only.
class AppRouteConfig {
  final String path;
  final String title;
  final String? permissionKey;
  final String? moduleCode;
  final IconData icon;
  final bool topLevel;

  const AppRouteConfig({
    required this.path,
    required this.title,
    required this.permissionKey,
    required this.moduleCode,
    required this.icon,
    this.topLevel = true,
  });

  bool matches(String route) =>
      route == path || route.startsWith('$path/');
}

class AppRoutes {
  AppRoutes._();

  static const dashboard = AppRouteConfig(
    path: '/dashboard',
    title: 'Dashboard',
    permissionKey: null,
    moduleCode: 'core',
    icon: Icons.dashboard_outlined,
  );

  static const organizations = AppRouteConfig(
    path: '/organizations',
    title: 'Organizations',
    permissionKey: 'organization.read',
    moduleCode: 'organization',
    icon: Icons.apartment_outlined,
  );

  static const branches = AppRouteConfig(
    path: '/organizations/branches',
    title: 'Branches',
    permissionKey: 'branch.read',
    moduleCode: 'branch',
    icon: Icons.store_outlined,
  );

  static const users = AppRouteConfig(
    path: '/users',
    title: 'Users',
    permissionKey: 'user.read',
    moduleCode: 'user-management',
    icon: Icons.people_outline,
  );

  static const roles = AppRouteConfig(
    path: '/roles',
    title: 'Roles',
    permissionKey: 'role.read',
    moduleCode: 'security',
    icon: Icons.admin_panel_settings_outlined,
  );

  static const permissions = AppRouteConfig(
    path: '/permissions',
    title: 'Permissions',
    permissionKey: 'permission.read',
    moduleCode: 'security',
    icon: Icons.lock_outline,
  );

  static const topLevel = <AppRouteConfig>[
    dashboard,
    organizations,
    branches,
    users,
    roles,
    permissions,
  ];

  static const routePermissions = <String, String?>{
    '/dashboard': null,
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

  static String canonicalTopLevel(String route) {
    for (final config in topLevel) {
      if (config.matches(route)) return config.path;
    }
    return dashboard.path;
  }

  static AppRouteConfig forRoute(String route) {
    for (final config in topLevel) {
      if (config.matches(route)) return config;
    }
    return dashboard;
  }
}
