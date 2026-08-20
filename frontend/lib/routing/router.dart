import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import '../core/auth/auth_service.dart';
import '../modules/dashboard/dashboard_screen.dart';
import '../modules/organization/list_screen.dart';
import '../modules/organization/create_screen.dart';
import '../modules/organization/details_screen.dart';
import '../modules/organization/edit_screen.dart';
import '../modules/auth/login_screen.dart';

class AppRouter {
  static Route<dynamic>? generateRoute(RouteSettings settings) {
    switch (settings.name) {
      case '/login':
        return MaterialPageRoute(builder: (_) => const LoginScreen());
      case '/dashboard':
        return MaterialPageRoute(builder: (_) => _authGuard((_) => const DashboardScreen()));
      case '/organizations':
        return MaterialPageRoute(builder: (_) => _authGuard((_) => const OrganizationListScreen()));
      case '/organizations/create':
        return MaterialPageRoute(builder: (_) => _authGuard((_) => const CreateOrganizationScreen()));
      case '/organizations/details':
        return MaterialPageRoute(builder: (_) {
          final id = settings.arguments as String? ?? '';
          return _authGuard((_) => OrganizationDetailsScreen(id: id));
        });
      case '/organizations/edit':
        return MaterialPageRoute(builder: (_) {
          final id = settings.arguments as String? ?? '';
          return _authGuard((_) => EditOrganizationScreen(id: id));
        });
      case '/organizations/branches':
        return MaterialPageRoute(builder: (_) {
          final orgId = settings.arguments as String? ?? '';
          return _authGuard((_) => BranchListScreen(organizationId: orgId));
        });
      case '/organizations/branches/create':
        return MaterialPageRoute(builder: (_) {
          final orgId = settings.arguments as String? ?? '';
          return _authGuard((_) => CreateBranchScreen(organizationId: orgId));
        });
      case '/organizations/branches/details':
        return MaterialPageRoute(builder: (_) {
          final args = settings.arguments as Map<String, dynamic>? ?? {};
          final orgId = args['organizationId'] as String? ?? '';
          final branchId = args['branchId'] as String? ?? '';
          return _authGuard((_) => BranchDetailsScreen(organizationId: orgId, branchId: branchId));
        });
      case '/organizations/branches/edit':
        return MaterialPageRoute(builder: (_) {
          final args = settings.arguments as Map<String, dynamic>? ?? {};
          final orgId = args['organizationId'] as String? ?? '';
          final branchId = args['branchId'] as String? ?? '';
          return _authGuard((_) => EditBranchScreen(organizationId: orgId, branchId: branchId));
        });
      default:
        return MaterialPageRoute(builder: (_) => Scaffold(body: Center(child: Text('Unknown route: ${settings.name}'))));
    }
  }

  static Widget _authGuard(WidgetBuilder builder) {
    final auth = GetIt.instance.get<AuthService>();
    if (!auth.isAuthenticated) {
      return const LoginScreen();
    }
    return builder(null);
  }
}
