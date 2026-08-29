import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import '../core/auth/auth_service.dart';
import '../modules/auth/login_screen.dart';
import '../modules/branch/create_screen.dart';
import '../modules/branch/details_screen.dart';
import '../modules/branch/edit_screen.dart';
import '../modules/branch/list_screen.dart';
import '../modules/dashboard/dashboard_screen.dart';
import '../modules/organization/create_screen.dart';
import '../modules/organization/details_screen.dart';
import '../modules/organization/edit_screen.dart';
import '../modules/organization/list_screen.dart';
import '../modules/permission/permission_list_screen.dart';
import '../modules/role/create_screen.dart';
import '../modules/role/edit_screen.dart';
import '../modules/role/list_screen.dart';
import '../modules/user/access_screen.dart';
import '../modules/user/create_screen.dart';
import '../modules/user/details_screen.dart';
import '../modules/user/edit_screen.dart';
import '../modules/user/list_screen.dart';
import '../modules/user/user_role_assignment_screen.dart';
import 'route_config.dart';

class AppRouter {
  static const Map<String, String?> routePermissions = AppRoutes.routePermissions;

  static Route<dynamic>? generateRoute(RouteSettings settings) {
    switch (settings.name) {
      case '/':
      case '/dashboard':
        return MaterialPageRoute(settings: const RouteSettings(name: '/dashboard'), builder: (context) => _protected(context, routeName: '/dashboard', child: const DashboardScreen()));
      case '/login':
        return MaterialPageRoute(settings: settings, builder: (_) => const LoginScreen());
      case '/organizations':
        return MaterialPageRoute(settings: settings, builder: (context) => _protected(context, routeName: '/organizations', child: const OrganizationListScreen()));
      case '/organizations/create':
        return MaterialPageRoute(settings: settings, builder: (context) => _protected(context, routeName: '/organizations/create', child: const CreateOrganizationScreen()));
      case '/organizations/details':
        return MaterialPageRoute(settings: settings, builder: (context) => _protected(context, routeName: '/organizations/details', child: OrganizationDetailsScreen(id: settings.arguments as String? ?? '')));
      case '/organizations/edit':
        return MaterialPageRoute(settings: settings, builder: (context) => _protected(context, routeName: '/organizations/edit', child: EditOrganizationScreen(id: settings.arguments as String? ?? '')));
      case '/organizations/branches':
        return MaterialPageRoute(settings: settings, builder: (context) => _protected(context, routeName: '/organizations/branches', child: BranchListScreen(organizationId: settings.arguments as String? ?? '')));
      case '/organizations/branches/create':
        return MaterialPageRoute(settings: settings, builder: (context) => _protected(context, routeName: '/organizations/branches/create', child: CreateBranchScreen(organizationId: settings.arguments as String? ?? '')));
      case '/organizations/branches/details':
        return MaterialPageRoute(settings: settings, builder: (context) { final args = settings.arguments as Map<String, dynamic>? ?? {}; return _protected(context, routeName: '/organizations/branches/details', child: BranchDetailsScreen(organizationId: args['organizationId'] as String? ?? '', branchId: args['branchId'] as String? ?? '')); });
      case '/organizations/branches/edit':
        return MaterialPageRoute(settings: settings, builder: (context) { final args = settings.arguments as Map<String, dynamic>? ?? {}; return _protected(context, routeName: '/organizations/branches/edit', child: EditBranchScreen(organizationId: args['organizationId'] as String? ?? '', branchId: args['branchId'] as String? ?? '')); });
      case '/users':
        return MaterialPageRoute(settings: settings, builder: (context) => _protected(context, routeName: '/users', child: const UserListScreen()));
      case '/users/create':
        return MaterialPageRoute(settings: settings, builder: (context) => _protected(context, routeName: '/users/create', child: const UserCreateScreen()));
      case '/users/details':
        return MaterialPageRoute(settings: settings, builder: (context) => _protected(context, routeName: '/users/details', child: const UserDetailsScreen()));
      case '/users/edit':
        return MaterialPageRoute(settings: settings, builder: (context) => _protected(context, routeName: '/users/edit', child: const UserEditScreen()));
      case '/users/roles':
        return MaterialPageRoute(settings: settings, builder: (context) => _protected(context, routeName: '/users/roles', child: UserRoleAssignmentScreen(userId: settings.arguments as String? ?? '')));
      case '/users/access':
        return MaterialPageRoute(settings: settings, builder: (context) => _protected(context, routeName: '/users/access', child: const UserAccessScreen()));
      case '/roles':
        return MaterialPageRoute(settings: settings, builder: (context) => _protected(context, routeName: '/roles', child: const RoleListScreen()));
      case '/roles/create':
        return MaterialPageRoute(settings: settings, builder: (context) => _protected(context, routeName: '/roles/create', child: const RoleCreateScreen()));
      case '/roles/edit':
        return MaterialPageRoute(settings: settings, builder: (context) => _protected(context, routeName: '/roles/edit', child: RoleEditScreen(roleId: settings.arguments as String? ?? '')));
      case '/permissions':
        return MaterialPageRoute(settings: settings, builder: (context) => _protected(context, routeName: '/permissions', child: const PermissionListScreen()));
      default:
        return MaterialPageRoute(settings: settings, builder: (_) => const _NotFoundScreen());
    }
  }

  static Widget _protected(BuildContext context, {required String routeName, required Widget child}) {
    final auth = GetIt.instance.get<AuthService>();
    if (!auth.isAuthenticated) return const LoginScreen();
    return _RouteAuthorizationGate(routeName: routeName, child: child);
  }
}

class _RouteAuthorizationGate extends StatefulWidget {
  final String routeName;
  final Widget child;
  const _RouteAuthorizationGate({required this.routeName, required this.child});
  @override
  State<_RouteAuthorizationGate> createState() => _RouteAuthorizationGateState();
}

class _RouteAuthorizationGateState extends State<_RouteAuthorizationGate> {
  bool _loadingStarted = false;
  AuthService get _auth => GetIt.instance.get<AuthService>();

  @override
  void initState() { super.initState(); _ensurePermissionsLoaded(); }

  Future<void> _ensurePermissionsLoaded() async {
    final requiredPermission = AppRouter.routePermissions[widget.routeName];
    if (requiredPermission == null || _auth.authzService.isLoaded || _auth.authzService.isLoading || _loadingStarted) return;
    _loadingStarted = true;
    final baseUrl = const String.fromEnvironment('API_BASE_URL', defaultValue: 'http://localhost:3000');
    await _auth.fetchEffectivePermissions(baseUrl);
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final requiredPermission = AppRouter.routePermissions[widget.routeName];
    if (!_auth.isAuthenticated) return const LoginScreen();
    if (requiredPermission != null && (!_auth.authzService.isLoaded || _auth.authzService.isLoading)) {
      return AnimatedBuilder(
        animation: _auth.authzService,
        builder: (context, _) => !_auth.authzService.isLoading && _auth.authzService.isLoaded
            ? _content(requiredPermission)
            : const Center(child: CircularProgressIndicator()),
      );
    }
    return _content(requiredPermission);
  }

  Widget _content(String? requiredPermission) {
    if (requiredPermission != null && !_auth.hasPermission(requiredPermission)) {
      return Center(child: Padding(padding: const EdgeInsets.all(24), child: Text('Access denied for ${widget.routeName}.\nRequired permission: $requiredPermission.', textAlign: TextAlign.center)));
    }
    return widget.child;
  }
}

class _NotFoundScreen extends StatelessWidget {
  const _NotFoundScreen();
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('Page not found'),
              const SizedBox(height: 12),
              FilledButton(onPressed: () => Navigator.of(context).pushNamedAndRemoveUntil('/dashboard', (_) => false), child: const Text('Go to Dashboard')),
            ],
          ),
        ),
      ),
    );
  }
}
