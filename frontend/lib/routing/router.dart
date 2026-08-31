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
    final auth = GetIt.instance.get<AuthService>();
    final path = settings.name ?? '/';

    if (auth.isAuthenticated && auth.requiresOrganizationSelection && path != '/login' && path != '/organization-selection') {
      return MaterialPageRoute(
        settings: const RouteSettings(name: '/organization-selection'),
        builder: (_) => const _OrganizationSelectionScreen(),
      );
    }

    switch (settings.name) {
      case '/':
      case '/dashboard':
        return MaterialPageRoute(settings: const RouteSettings(name: '/dashboard'), builder: (context) => _protected(context, routeName: '/dashboard', child: const DashboardScreen()));
      case '/login':
        return MaterialPageRoute(settings: settings, builder: (_) => const LoginScreen());
      case '/organization-selection':
        return MaterialPageRoute(settings: settings, builder: (_) => const _OrganizationSelectionScreen());
      case '/settings':
        return MaterialPageRoute(
          settings: settings,
          builder: (context) => _protected(
            context,
            routeName: '/settings/organizations',
            child: const OrganizationListScreen(),
          ),
        );
      case '/settings/organizations':
        return MaterialPageRoute(
          settings: settings,
          builder: (context) => _protected(
            context,
            routeName: '/settings/organizations',
            child: const OrganizationListScreen(),
          ),
        );
      case '/settings/organizations/create':
        return MaterialPageRoute(
          settings: settings,
          builder: (context) => _protected(
            context,
            routeName: '/settings/organizations/create',
            child: const CreateOrganizationScreen(),
          ),
        );
      case '/settings/organizations/details':
        return MaterialPageRoute(
          settings: settings,
          builder: (context) => _protected(
            context,
            routeName: '/settings/organizations/details',
            child: OrganizationDetailsScreen(id: settings.arguments as String? ?? ''),
          ),
        );
      case '/settings/organizations/edit':
        return MaterialPageRoute(
          settings: settings,
          builder: (context) => _protected(
            context,
            routeName: '/settings/organizations/edit',
            child: EditOrganizationScreen(id: settings.arguments as String? ?? ''),
          ),
        );
      case '/settings/branches': {
        final organizationId = (settings.arguments is String ? settings.arguments as String? : null) ?? auth.currentOrganizationId ?? auth.selectedOrganizationId ?? '';
        return MaterialPageRoute(
          settings: settings,
          builder: (context) => _protected(
            context,
            routeName: '/settings/branches',
            child: BranchListScreen(organizationId: organizationId),
          ),
        );
      }
      case '/settings/branches/create': {
        final organizationId = (settings.arguments is String ? settings.arguments as String? : null) ?? auth.currentOrganizationId ?? auth.selectedOrganizationId ?? '';
        return MaterialPageRoute(
          settings: settings,
          builder: (context) => _protected(
            context,
            routeName: '/settings/branches/create',
            child: CreateBranchScreen(organizationId: organizationId),
          ),
        );
      }
      case '/settings/branches/details': {
        final args = settings.arguments as Map<String, dynamic>? ?? {};
        final organizationId = (args['organizationId'] as String? ?? auth.currentOrganizationId ?? auth.selectedOrganizationId ?? '');
        return MaterialPageRoute(
          settings: settings,
          builder: (context) => _protected(
            context,
            routeName: '/settings/branches/details',
            child: BranchDetailsScreen(organizationId: organizationId, branchId: args['branchId'] as String? ?? ''),
          ),
        );
      }
      case '/settings/branches/edit': {
        final args = settings.arguments as Map<String, dynamic>? ?? {};
        final organizationId = (args['organizationId'] as String? ?? auth.currentOrganizationId ?? auth.selectedOrganizationId ?? '');
        return MaterialPageRoute(
          settings: settings,
          builder: (context) => _protected(
            context,
            routeName: '/settings/branches/edit',
            child: EditBranchScreen(organizationId: organizationId, branchId: args['branchId'] as String? ?? ''),
          ),
        );
      }
      case '/organizations':
        return MaterialPageRoute(settings: settings, builder: (context) => _protected(context, routeName: '/organizations', child: const OrganizationListScreen()));
      case '/organizations/create':
        return MaterialPageRoute(settings: settings, builder: (context) => _protected(context, routeName: '/organizations/create', child: const CreateOrganizationScreen()));
      case '/organizations/details':
        return MaterialPageRoute(settings: settings, builder: (context) => _protected(context, routeName: '/organizations/details', child: OrganizationDetailsScreen(id: settings.arguments as String? ?? '')));
      case '/organizations/edit':
        return MaterialPageRoute(settings: settings, builder: (context) => _protected(context, routeName: '/organizations/edit', child: EditOrganizationScreen(id: settings.arguments as String? ?? '')));
      case '/organizations/branches': {
        final organizationId = (settings.arguments is String ? settings.arguments as String? : null) ?? auth.currentOrganizationId ?? auth.selectedOrganizationId ?? '';
        return MaterialPageRoute(settings: settings, builder: (context) => _protected(context, routeName: '/organizations/branches', child: BranchListScreen(organizationId: organizationId)));
      }
      case '/organizations/branches/create': {
        final organizationId = (settings.arguments is String ? settings.arguments as String? : null) ?? auth.currentOrganizationId ?? auth.selectedOrganizationId ?? '';
        return MaterialPageRoute(settings: settings, builder: (context) => _protected(context, routeName: '/organizations/branches/create', child: CreateBranchScreen(organizationId: organizationId)));
      }
      case '/organizations/branches/details': {
        final args = settings.arguments as Map<String, dynamic>? ?? {};
        final organizationId = (args['organizationId'] as String? ?? auth.currentOrganizationId ?? auth.selectedOrganizationId ?? '');
        return MaterialPageRoute(settings: settings, builder: (context) => _protected(context, routeName: '/organizations/branches/details', child: BranchDetailsScreen(organizationId: organizationId, branchId: args['branchId'] as String? ?? '')));
      }
      case '/organizations/branches/edit': {
        final args = settings.arguments as Map<String, dynamic>? ?? {};
        final organizationId = (args['organizationId'] as String? ?? auth.currentOrganizationId ?? auth.selectedOrganizationId ?? '');
        return MaterialPageRoute(settings: settings, builder: (context) => _protected(context, routeName: '/organizations/branches/edit', child: EditBranchScreen(organizationId: organizationId, branchId: args['branchId'] as String? ?? '')));
      }
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
    if (auth.requiresOrganizationSelection) {
      return const _OrganizationSelectionScreen();
    }
    return _RouteAuthorizationGate(routeName: routeName, child: child);
  }
}

class _OrganizationSelectionScreen extends StatelessWidget {
  const _OrganizationSelectionScreen();

  @override
  Widget build(BuildContext context) {
    final auth = GetIt.instance.get<AuthService>();

    return Scaffold(
      appBar: AppBar(title: const Text('Select organization')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: auth.availableOrganizations.isEmpty
              ? const Center(child: Text('Select organization'))
              : ListView.separated(
                  itemCount: auth.availableOrganizations.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 12),
                  itemBuilder: (context, index) {
                    final org = auth.availableOrganizations[index];
                    final id = (org['id'] ?? '').toString();
                    final name = (org['name'] ?? id).toString();

                    return Card(
                      child: ListTile(
                        title: Text(name),
                        trailing: FilledButton(
                          onPressed: () async {
                            final ok = await auth.selectOrganization(id);
                            if (ok && context.mounted) {
                              Navigator.of(context).pushNamedAndRemoveUntil('/dashboard', (_) => false);
                            }
                          },
                          child: const Text('Select'),
                        ),
                      ),
                    );
                  },
                ),
        ),
      ),
    );
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
  void initState() {
    super.initState();
    _ensurePermissionsLoaded();
  }

  Future<void> _ensurePermissionsLoaded() async {
    final requiredPermission = AppRouter.routePermissions[widget.routeName];
    if (requiredPermission == null || !_auth.isAuthenticated) return;
    if (_auth.authzService.isLoaded || _auth.authzService.isLoading || _loadingStarted) return;
    _loadingStarted = true;
    await _auth.ensureEffectivePermissionsLoaded();
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final requiredPermission = AppRouter.routePermissions[widget.routeName];
    if (!_auth.isAuthenticated) return const LoginScreen();

    if (requiredPermission != null) {
      if (_auth.authzService.isLoading) {
        return const Center(child: CircularProgressIndicator());
      }
      if (!_auth.authzService.isLoaded) {
        return const Center(child: CircularProgressIndicator());
      }
      if (!_auth.hasPermission(requiredPermission)) {
        return Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'Access denied',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 8),
                Text(
                  'Required permission: $requiredPermission.',
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        );
      }
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
