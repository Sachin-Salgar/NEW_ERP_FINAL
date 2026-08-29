import 'package:flutter/material.dart';

import '../modules/dashboard/dashboard_screen.dart';
import '../modules/organization/list_screen.dart';
import '../modules/branch/list_screen.dart';
import '../modules/role/list_screen.dart';
import '../modules/permission/permission_list_screen.dart';

class AppRoutes {
  static Route<dynamic>? onGenerateRoute(RouteSettings settings) {
    switch (settings.name) {
      case '/':
      case '/dashboard':
        return _page(settings, const DashboardScreen());
      case '/organizations':
        return _page(settings, const OrganizationListScreen());
      case '/organizations/branches':
        return _page(settings, const BranchListScreen());
      case '/roles':
        return _page(settings, const RoleListScreen());
      case '/permissions':
        return _page(settings, const PermissionListScreen());
      default:
        return null;
    }
  }

  static MaterialPageRoute<dynamic> _page(
    RouteSettings settings,
    Widget child,
  ) => MaterialPageRoute(
    settings: settings,
    builder: (_) => child,
  );
}
