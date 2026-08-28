import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import '../core/auth/auth_service.dart';
import '../presentation/ui/components/navigation_sidebar.dart';
import '../presentation/ui/components/topbar.dart';
import '../routing/router.dart';
import 'profile_context_menu.dart';

class AppShell extends StatelessWidget {
  final Widget child;
  const AppShell({super.key, required this.child});

  List<Map<String, dynamic>> _navigationItems(AuthService auth) {
    final items = <Map<String, dynamic>>[
      {'menuName': 'Dashboard', 'path': '/dashboard', 'permissionKey': null, 'moduleCode': 'core'},
      {'menuName': 'Organizations', 'path': '/organizations', 'permissionKey': AppRouter.routePermissions['/organizations'], 'moduleCode': 'organization'},
      {'menuName': 'Branches', 'path': '/organizations/branches', 'permissionKey': AppRouter.routePermissions['/organizations/branches'], 'moduleCode': 'branch'},
      {'menuName': 'Users', 'path': '/users', 'permissionKey': AppRouter.routePermissions['/users'], 'moduleCode': 'user-management'},
      {'menuName': 'Roles', 'path': '/roles', 'permissionKey': AppRouter.routePermissions['/roles'], 'moduleCode': 'security'},
      {'menuName': 'Permissions', 'path': '/permissions', 'permissionKey': AppRouter.routePermissions['/permissions'], 'moduleCode': 'security'},
    ];
    return items.where((item) {
      final permission = item['permissionKey'] as String?;
      final module = item['moduleCode'] as String?;
      return (permission == null || auth.hasPermission(permission)) &&
          (module == null || auth.hasModule(module));
    }).toList();
  }

  void _handleNavigate(BuildContext context, String route) {
    Navigator.of(context).pushReplacementNamed(route);
  }

  Future<void> _logout(BuildContext context, AuthService auth) async {
    await auth.logout();
    if (context.mounted) Navigator.of(context).pushReplacementNamed('/login');
  }

  @override
  Widget build(BuildContext context) {
    final auth = GetIt.instance.get<AuthService>();
    final navItems = _navigationItems(auth);
    final width = MediaQuery.sizeOf(context).width;

    // Match the upstream template's responsive model: desktop keeps the
    // navigation rail visible; tablet/mobile use the navigation drawer.
    if (width >= 1100) {
      return Scaffold(
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
        body: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Sidebar(
              selectedRoute: ModalRoute.of(context)?.settings.name ?? '/',
              onSelect: (route) => _handleNavigate(context, route),
            ),
            Expanded(
              child: Column(
                children: [
                  TopBar(
                    title: _pageTitle(ModalRoute.of(context)?.settings.name),
                    actions: [
                      if (auth.currentUser != null) const ProfileContextMenu(),
                    ],
                  ),
                  Expanded(child: child),
                ],
              ),
            ),
          ],
        ),
      );
    }

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: TopBar(
        title: _pageTitle(ModalRoute.of(context)?.settings.name),
        actions: [
          if (auth.currentUser != null) const ProfileContextMenu(),
        ],
      ),
      drawer: Drawer(
        child: SafeArea(
          child: Column(
            children: [
              _BrandHeader(),
              Divider(height: 1, color: Theme.of(context).dividerColor),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  children: navItems.map((item) => ListTile(
                    leading: Icon(_iconForRoute(item['path'] as String)),
                    title: Text(item['menuName'] as String),
                    selected: ModalRoute.of(context)?.settings.name == item['path'],
                    selectedColor: Theme.of(context).colorScheme.primary,
                    onTap: () {
                      Navigator.of(context).pop();
                      _handleNavigate(context, item['path'] as String);
                    },
                  )).toList(),
                ),
              ),
              Divider(height: 1, color: Theme.of(context).dividerColor),
              ListTile(
                leading: const Icon(Icons.logout_outlined),
                title: const Text('Logout'),
                onTap: () => _logout(context, auth),
              ),
            ],
          ),
        ),
      ),
      body: child,
    );
  }

  String _pageTitle(String? route) {
    if (route == null) return 'Dashboard';
    if (route.startsWith('/organizations')) return 'Organizations';
    if (route.startsWith('/users')) return 'Users';
    if (route.startsWith('/roles')) return 'Roles';
    if (route.startsWith('/permissions')) return 'Permissions';
    return 'Dashboard';
  }

  static IconData _iconForRoute(String route) {
    if (route == '/dashboard') return Icons.dashboard_outlined;
    if (route.startsWith('/organizations/branches')) return Icons.store_outlined;
    if (route.startsWith('/organizations')) return Icons.apartment_outlined;
    if (route.startsWith('/users')) return Icons.people_outline;
    if (route.startsWith('/roles')) return Icons.admin_panel_settings_outlined;
    return Icons.lock_outline;
  }
}

class _BrandHeader extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: theme.colorScheme.primary,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(Icons.grid_view_rounded, color: theme.colorScheme.onPrimary),
          ),
          const SizedBox(width: 12),
          Text('NEW ERP', style: theme.textTheme.titleLarge),
        ],
      ),
    );
  }
}
