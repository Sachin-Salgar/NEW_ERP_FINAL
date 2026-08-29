import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import '../core/auth/auth_service.dart';
import '../presentation/ui/components/navigation_sidebar.dart';
import '../presentation/ui/components/topbar.dart';
import '../routing/route_config.dart';
import '../routing/route_state.dart';
import 'profile_context_menu.dart';

class AppShell extends StatefulWidget {
  final Widget child;
  final GlobalKey<NavigatorState> navigatorKey;
  final GlobalKey<NavigatorState> rootNavigatorKey;

  const AppShell({super.key, required this.child, required this.navigatorKey, required this.rootNavigatorKey});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  bool _sidebarCollapsed = false;

  List<AppRouteConfig> _navigationItems(AuthService auth) {
    return AppRoutes.topLevel.where((item) {
      final permission = item.permissionKey;
      final module = item.moduleCode;
      return (permission == null || auth.hasPermission(permission)) &&
          (module == null || auth.hasModule(module));
    }).toList(growable: false);
  }

  void _handleNavigate(String route) {
    final target = AppRoutes.normalize(route);
    final current = AppRouteState.currentRoute.value;
    if (current == target || current?.startsWith('$target/') == true) return;
    widget.navigatorKey.currentState?.pushNamed(target);
  }

  Future<void> _logout(AuthService auth) async => auth.logout();

  void _toggleSidebar() => setState(() => _sidebarCollapsed = !_sidebarCollapsed);

  @override
  Widget build(BuildContext context) {
    final auth = GetIt.instance.get<AuthService>();
    return AnimatedBuilder(
      animation: Listenable.merge([auth.authzService, AppRouteState.currentRoute]),
      builder: (context, _) => _buildShell(context, auth),
    );
  }

  Widget _buildShell(BuildContext context, AuthService auth) {
    final navItems = _navigationItems(auth);
    final width = MediaQuery.sizeOf(context).width;
    final isDesktop = width >= 1100;
    final route = AppRoutes.normalize(AppRouteState.currentRoute.value ?? '/dashboard');
    final routeConfig = AppRoutes.forRoute(route);

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
              child: Sidebar(collapsed: _sidebarCollapsed, selectedRoute: route, onSelect: _handleNavigate),
            ),
            Expanded(
              child: Column(
                children: [
                  TopBar(
                    title: routeConfig.title,
                    onMenuPressed: _toggleSidebar,
                    navigationCollapsed: _sidebarCollapsed,
                    actions: [if (auth.currentUser != null) const ProfileContextMenu()],
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
        title: routeConfig.title,
        actions: [if (auth.currentUser != null) const ProfileContextMenu()],
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
                    leading: Icon(item.icon),
                    title: Text(item.title),
                    selected: item.matches(route),
                    selectedColor: Theme.of(context).colorScheme.primary,
                    onTap: () {
                      Navigator.of(context).pop();
                      _handleNavigate(item.path);
                    },
                  )).toList(),
                ),
              ),
              Divider(height: 1, color: Theme.of(context).dividerColor),
              ListTile(
                leading: const Icon(Icons.logout_outlined),
                title: const Text('Logout'),
                onTap: () => _logout(auth),
              ),
            ],
          ),
        ),
      ),
      body: widget.child,
    );
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
            decoration: BoxDecoration(color: theme.colorScheme.primary, borderRadius: BorderRadius.circular(10)),
            child: Icon(Icons.grid_view_rounded, color: theme.colorScheme.onPrimary),
          ),
          const SizedBox(width: 12),
          Text('NEW ERP', style: theme.textTheme.titleLarge),
        ],
      ),
    );
  }
}
