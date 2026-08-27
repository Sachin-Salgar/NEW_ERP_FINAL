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
import '../modules/user/user_role_assignment_screen.dart';
import '../modules/role/list_screen.dart';
import '../modules/role/create_screen.dart';
import '../modules/role/edit_screen.dart';
import '../modules/permission/permission_list_screen.dart';
import '../modules/auth/login_screen.dart';

class AppRouter {
  static const Map<String, String?> routePermissions = {
    '/dashboard': null, '/organizations': 'organization.read', '/organizations/create': 'organization.manage',
    '/organizations/details': 'organization.read', '/organizations/edit': 'organization.manage', '/organizations/branches': 'branch.read',
    '/organizations/branches/create': 'branch.manage', '/organizations/branches/details': 'branch.read', '/organizations/branches/edit': 'branch.manage',
    '/users': 'user.read', '/users/create': 'user.manage', '/users/details': 'user.read', '/users/edit': 'user.manage', '/users/roles': 'user.manage', '/users/access': 'user.manage',
    '/roles': 'role.read', '/roles/create': 'role.manage', '/roles/edit': 'role.manage', '/permissions': 'permission.read',
  };

  static Route<dynamic>? generateRoute(RouteSettings settings) {
    switch (settings.name) {
      case '/login': return MaterialPageRoute(builder: (_) => const LoginScreen());
      case '/dashboard': return MaterialPageRoute(builder: (context) => _authGuard(context, (_) => const DashboardScreen(), routeName: '/dashboard'));
      case '/organizations': return MaterialPageRoute(builder: (context) => _authGuard(context, (_) => const OrganizationListScreen(), routeName: '/organizations'));
      case '/organizations/create': return MaterialPageRoute(builder: (context) => _authGuard(context, (_) => const CreateOrganizationScreen(), routeName: '/organizations/create'));
      case '/organizations/details': return MaterialPageRoute(builder: (context) { final id=settings.arguments as String? ?? ''; return _authGuard(context, (_) => OrganizationDetailsScreen(id:id), routeName:'/organizations/details'); });
      case '/organizations/edit': return MaterialPageRoute(builder: (context) { final id=settings.arguments as String? ?? ''; return _authGuard(context, (_) => EditOrganizationScreen(id:id), routeName:'/organizations/edit'); });
      case '/organizations/branches': return MaterialPageRoute(builder: (context) { final id=settings.arguments as String? ?? ''; return _authGuard(context, (_) => BranchListScreen(organizationId:id), routeName:'/organizations/branches'); });
      case '/organizations/branches/create': return MaterialPageRoute(builder: (context) { final id=settings.arguments as String? ?? ''; return _authGuard(context, (_) => CreateBranchScreen(organizationId:id), routeName:'/organizations/branches/create'); });
      case '/organizations/branches/details': return MaterialPageRoute(builder: (context) { final a=settings.arguments as Map<String,dynamic>? ?? {}; return _authGuard(context, (_) => BranchDetailsScreen(organizationId:a['organizationId'] as String? ?? '', branchId:a['branchId'] as String? ?? ''), routeName:'/organizations/branches/details'); });
      case '/organizations/branches/edit': return MaterialPageRoute(builder: (context) { final a=settings.arguments as Map<String,dynamic>? ?? {}; return _authGuard(context, (_) => EditBranchScreen(organizationId:a['organizationId'] as String? ?? '', branchId:a['branchId'] as String? ?? ''), routeName:'/organizations/branches/edit'); });
      case '/users': return MaterialPageRoute(builder: (context) => _authGuard(context, (_) => const UserListScreen(), routeName:'/users'));
      case '/users/create': return MaterialPageRoute(builder: (context) => _authGuard(context, (_) => const UserCreateScreen(), routeName:'/users/create'));
      case '/users/details': return MaterialPageRoute(builder: (context) => _authGuard(context, (_) => const UserDetailsScreen(), routeName:'/users/details'));
      case '/users/edit': return MaterialPageRoute(builder: (context) => _authGuard(context, (_) => const UserEditScreen(), routeName:'/users/edit'));
      case '/users/roles': return MaterialPageRoute(builder: (context) { final id=settings.arguments as String? ?? ''; return _authGuard(context, (_) => UserRoleAssignmentScreen(userId:id), routeName:'/users/roles'); });
      case '/users/access': return MaterialPageRoute(builder: (context) => _authGuard(context, (_) => const UserAccessScreen(), routeName:'/users/access'));
      case '/roles': return MaterialPageRoute(builder: (context) => _authGuard(context, (_) => const RoleListScreen(), routeName:'/roles'));
      case '/roles/create': return MaterialPageRoute(builder: (context) => _authGuard(context, (_) => const RoleCreateScreen(), routeName:'/roles/create'));
      case '/roles/edit': return MaterialPageRoute(builder: (context) { final id=settings.arguments as String? ?? ''; return _authGuard(context, (_) => RoleEditScreen(roleId:id), routeName:'/roles/edit'); });
      case '/permissions': return MaterialPageRoute(builder: (context) => _authGuard(context, (_) => const PermissionListScreen(), routeName:'/permissions'));
      default: return MaterialPageRoute(builder: (_) => Scaffold(body: Center(child: Text('Unknown route: ${settings.name}'))));
    }
  }

  static Widget _permissionDeniedScreen(String routeName, String permissionKey) => Scaffold(appBar: AppBar(title: const Text('Access denied')), body: Center(child: Padding(padding: const EdgeInsets.all(24), child: Text('Access denied for $routeName. Required permission: $permissionKey.', textAlign: TextAlign.center))));
  static Widget _authGuard(BuildContext context, WidgetBuilder builder, {required String routeName}) {
    final auth=GetIt.instance.get<AuthService>();
    if (!auth.isAuthenticated) return const LoginScreen();
    final requiredPermission=routePermissions[routeName];
    if (requiredPermission != null && !auth.hasPermission(requiredPermission)) return _permissionDeniedScreen(routeName, requiredPermission);
    return builder(context);
  }
}
