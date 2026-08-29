import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import '../core/auth/auth_service.dart';
import '../presentation/ui/components/navigation_sidebar.dart';
import '../presentation/ui/components/topbar.dart';
import 'profile_context_menu.dart';

class AppShell extends StatefulWidget {
  final Widget child;

  const AppShell({super.key, required this.child});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  bool _sidebarCollapsed = false;

  List<Map<String, dynamic>> _navigationItems(AuthService auth) {
    final items = <Map<String, dynamic>>[
      {
        'menuName': 'Dashboard',
        'path': '/dashboard',
        'permissionKey': null,
        'moduleCode': 'core',
      },
      {
        'menuName': 'Organizations',
        'path': '/organizations',
        'permissionKey': 'organization.read',
        'moduleCode': 'organization',
      },
      {
        'menuName': 'Branches',
        'path': '/organizations/branches',
        'permissionKey': 'branch.read',
        'moduleCode': 'branch',
      },
      {
        'menuName': 'Users',
        'path': '/users',
        'permissionKey': 'user.read',
        'moduleCode': 'user-management',
      },
      {
        'menuName': 'Roles',
        'path': '/roles',
        'permissionKey': 'role.read',
        'moduleCode': 'security',
      },
      {
        'menuName': 'Permissions',
        'path': '/permissions',
        'permissionKey': 'permission.read',
        'moduleCode': 'security',
      },
    ];

    return items.where((item) {
      final permission = item['permissionKey'] as String?;
      final module = item['moduleCode'] as String?;
      return (permission == null || auth.hasPermission(permission)) &&
          (module == null || auth.hasModule(module));
    }).toList();
  }

  void _handleNavigate(BuildContext context, String route) {
    final currentRoute = ModalRoute.of(context)?.settings.name;
    if (currentRoute == route || currentRoute?.startsWith('$route/') == true) {
      return;
    }
    Navigator.of(context).pushNamed(route);
  }

  Future<void> _logout(BuildContext context, AuthService auth) async {
    await auth.logout();
    if (context.mounted) {
      Navigator.of(context).pushNamedAndRemoveUntil('/login', (_) => false);
    }
  }

  void _toggleSidebar() {
    setState(() => _sidebarCollapsed = !_sidebarCollapsed);
  }

  @override
  Widget build(BuildContext context) {
    final auth = GetIt.instance.get<AuthService>();

    return AnimatedBuilder(
      animation: auth.authzService,
      builder: (context, _) => _buildShell(context, auth),
    );
  }

  Widget _buildShell(BuildContext context, AuthService auth) {
    final navItems = _navigationItems(auth);
    final width = MediaQuery.sizeOf(context).width;
    final isDesktop = width >= 1100;
    final route = ModalRoute.of(context)?.settings.name;

    if (isDesktop) {
      return Scaffold(
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
        body: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 220),
              curve: Curves.easeInOut,
              width: _sidebarCollapsed ? 76 : width / 6,
              child: Sidebar(
                collapsed: _sidebarCollapsed,
                selectedRoute: route ?? '/dashboard',
                onSelect: (path) => _handleNavigate(context, path),
              ),
            ),
            Expanded(
              child: Column(
                children: [
                  TopBar(
                    title: _pageTitle(route),
                    onMenuPressed: _toggleSidebar,
                    navigationCollapsed: _sidebarCollapsed,
                    actions: [
                      if (auth.currentUser != null)
                        const ProfileContextMenu(),
                    ],
                  ),
                  Expanded(child: widget.child),
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
        title: _pageTitle(route),
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
                  children: navItems
                      .map(
                        (item) => ListTile(
                          leading: Icon(_iconForRoute(item['path'] as String)),
                          title: Text(item['menuName'] as String),
                          selected: route == item['path'],
                          selectedColor:
                              Theme.of(context).colorScheme.primary,
                          onTap: () {
                            Navigator.of(context).pop();
                            _handleNavigate(context, item['path'] as String);
                          },
                        ),
                      )
                      .toList(),
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
      body: widget.child,
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
    if (route.startsWith('/organizations/branches')) {
      return Icons.store_outlined;
    }
    if (route.startsWith('/organizations')) {
      return Icons.apartment_outlined;
    }
    if (route.startsWith('/users')) return Icons.people_outline;
    if (route.startsWith('/roles')) {
      return Icons.admin_panel_settings_outlined;
    }
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
            child: Icon(
              Icons.grid_view_rounded,
              color: theme.colorScheme.onPrimary,
            ),
          ),
          const SizedBox(width: 12),
          Text('NEW ERP', style: theme.textTheme.titleLarge),
        ],
      ),
    );
  }
}
