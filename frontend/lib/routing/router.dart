import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import '../core/auth/auth_service.dart';
import '../modules/dashboard/dashboard_screen.dart';
import '../modules/organization/list_screen.dart';
import '../modules/organization/create_screen.dart';
import '../modules/organization/details_screen.dart';
import '../modules/organization/edit_screen.dart';
import '../modules/branch/list_screen.dart';
import '../modules/branch/create_screen.dart';
import '../modules/branch/details_screen.dart';
import '../modules/branch/edit_screen.dart';
import '../modules/user/list_screen.dart';
import '../modules/user/create_screen.dart';
import '../modules/user/details_screen.dart';
import '../modules/user/edit_screen.dart';
import '../modules/user/access_screen.dart';
import '../modules/auth/login_screen.dart';
import '../modules/auth/location_selection_screen.dart';
import '../modules/auth/organization_selection_screen.dart';

class AppRouter {
  static Route<dynamic>? generateRoute(RouteSettings settings) {
    switch (settings.name) {
      case '/login':
        return MaterialPageRoute(builder: (_) => const LoginScreen());
      case '/organization-selection':
        return MaterialPageRoute(
          builder: (_) => const OrganizationSelectionScreen(),
        );
      case '/location-selection':
        return MaterialPageRoute(
          builder: (_) => const LocationSelectionScreen(),
        );
      case '/dashboard':
        return MaterialPageRoute(
          builder: (context) =>
              _authGuard(context, (_) => const DashboardScreen()),
        );
      case '/organizations':
        return MaterialPageRoute(
          builder: (context) =>
              _authGuard(context, (_) => const OrganizationListScreen()),
        );
      case '/organizations/create':
        return MaterialPageRoute(
          builder: (context) =>
              _authGuard(context, (_) => const CreateOrganizationScreen()),
        );
      case '/organizations/details':
        return MaterialPageRoute(
          builder: (context) {
            final id = settings.arguments as String? ?? '';
            return _authGuard(
              context,
              (_) => OrganizationDetailsScreen(id: id),
            );
          },
        );
      case '/organizations/edit':
        return MaterialPageRoute(
          builder: (context) {
            final id = settings.arguments as String? ?? '';
            return _authGuard(context, (_) => EditOrganizationScreen(id: id));
          },
        );
      case '/organizations/branches':
        return MaterialPageRoute(
          builder: (context) {
            final orgId = settings.arguments as String? ?? '';
            return _authGuard(
              context,
              (_) => BranchListScreen(organizationId: orgId),
            );
          },
        );
      case '/organizations/branches/create':
        return MaterialPageRoute(
          builder: (context) {
            final orgId = settings.arguments as String? ?? '';
            return _authGuard(
              context,
              (_) => CreateBranchScreen(organizationId: orgId),
            );
          },
        );
      case '/organizations/branches/details':
        return MaterialPageRoute(
          builder: (context) {
            final args = settings.arguments as Map<String, dynamic>? ?? {};
            final orgId = args['organizationId'] as String? ?? '';
            final branchId = args['branchId'] as String? ?? '';
            return _authGuard(
              context,
              (_) => BranchDetailsScreen(
                organizationId: orgId,
                branchId: branchId,
              ),
            );
          },
        );
      case '/organizations/branches/edit':
        return MaterialPageRoute(
          builder: (context) {
            final args = settings.arguments as Map<String, dynamic>? ?? {};
            final orgId = args['organizationId'] as String? ?? '';
            final branchId = args['branchId'] as String? ?? '';
            return _authGuard(
              context,
              (_) =>
                  EditBranchScreen(organizationId: orgId, branchId: branchId),
            );
          },
        );
      case '/users':
        return MaterialPageRoute(
          builder: (context) =>
              _authGuard(context, (_) => const UserListScreen()),
        );
      case '/users/create':
        return MaterialPageRoute(
          builder: (context) =>
              _authGuard(context, (_) => const UserCreateScreen()),
        );
      case '/users/details':
        return MaterialPageRoute(
          builder: (context) {
            return _authGuard(context, (_) => const UserDetailsScreen());
          },
        );
      case '/users/edit':
        return MaterialPageRoute(
          builder: (context) {
            return _authGuard(context, (_) => const UserEditScreen());
          },
        );
      case '/users/access':
        return MaterialPageRoute(
          builder: (context) =>
              _authGuard(context, (_) => const UserAccessScreen()),
        );
      default:
        return MaterialPageRoute(
          builder: (_) => Scaffold(
            body: Center(child: Text('Unknown route: ${settings.name}')),
          ),
        );
    }
  }

  static Widget _authGuard(BuildContext context, WidgetBuilder builder) {
    final auth = GetIt.instance.get<AuthService>();
    if (!auth.isAuthenticated) {
      return const LoginScreen();
    }
    return builder(context);
  }
}
