import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import '../../../core/auth/auth_service.dart';
import '../../../routing/router.dart';

class Sidebar extends StatefulWidget {
  final String selectedRoute;
  final ValueChanged<String>? onSelect;

  const Sidebar({super.key, required this.selectedRoute, this.onSelect});

  @override
  State<Sidebar> createState() => _SidebarState();
}

class _SidebarState extends State<Sidebar> {
  String expandedMenuName = '';

  final List<Map<String, dynamic>> _menuGroups = [
    {
      'groupName': 'GENERAL',
      'menuList': [
        {'menuName': 'Dashboard', 'path': '/dashboard', 'icon': Icons.dashboard_outlined, 'permissionKey': null, 'moduleCode': 'core'},
      ],
    },
    {
      'groupName': 'MANAGEMENT',
      'menuList': [
        {'menuName': 'Organizations', 'path': '/organizations', 'icon': Icons.apartment_outlined, 'permissionKey': 'organization.read', 'moduleCode': 'organization'},
        {'menuName': 'Branches', 'path': '/organizations/branches', 'icon': Icons.store_outlined, 'permissionKey': 'branch.read', 'moduleCode': 'branch'},
        {'menuName': 'Users', 'path': '/users', 'icon': Icons.people_outline, 'permissionKey': 'user.read', 'moduleCode': 'user-management'},
        {'menuName': 'Roles', 'path': '/roles', 'icon': Icons.admin_panel_settings_outlined, 'permissionKey': 'role.read', 'moduleCode': 'security'},
        {'menuName': 'Permissions', 'path': '/permissions', 'icon': Icons.lock_outline, 'permissionKey': 'permission.read', 'moduleCode': 'security'},
      ],
    },
  ];

  List<Map<String, dynamic>> _visibleMenuGroups(AuthService auth) {
    final visibleGroups = <Map<String, dynamic>>[];
    for (final group in _menuGroups) {
      final menuList = (group['menuList'] as List<dynamic>).where((entry) {
        final permissionKey = entry['permissionKey'] as String?;
        final moduleCode = entry['moduleCode'] as String?;
        return (moduleCode == null || auth.hasModule(moduleCode)) &&
            (permissionKey == null || auth.hasPermission(permissionKey));
      }).toList();
      if (menuList.isNotEmpty) visibleGroups.add({...group, 'menuList': menuList});
    }
    return visibleGroups;
  }

  bool _isSelectedPath(BuildContext context, String path) {
    final route = ModalRoute.of(context)?.settings.name;
    return route == path || (route != null && route.endsWith(path));
  }

  @override
  Widget build(BuildContext context) {
    final auth = GetIt.instance.get<AuthService>();
    final groups = _visibleMenuGroups(auth);
    final theme = Theme.of(context);

    return Container(
      width: 260,
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        border: Border(right: BorderSide(color: theme.dividerColor)),
      ),
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 22, 20, 20),
              child: Row(
                children: [
                  Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      color: theme.colorScheme.primary,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(Icons.grid_view_rounded, color: theme.colorScheme.onPrimary, size: 21),
                  ),
                  const SizedBox(width: 12),
                  Text('NEW ERP', style: theme.textTheme.titleLarge),
                ],
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(vertical: 12),
                children: groups.map((group) {
                  final title = group['groupName'] as String;
                  final items = group['menuList'] as List<dynamic>;
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(20, 12, 20, 8),
                        child: Text(title, style: theme.textTheme.labelSmall?.copyWith(letterSpacing: 1.1, fontWeight: FontWeight.w600)),
                      ),
                      ...items.map((entry) => _buildItem(context, entry as Map<String, dynamic>)),
                      const SizedBox(height: 10),
                    ],
                  );
                }).toList(),
              ),
            ),
            const Divider(height: 1),
            Padding(
              padding: const EdgeInsets.all(12),
              child: Text('NEW ERP • CORE', textAlign: TextAlign.center, style: theme.textTheme.labelSmall),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildItem(BuildContext context, Map<String, dynamic> entry) {
    final theme = Theme.of(context);
    final path = entry['path'] as String;
    final selected = _isSelectedPath(context, path);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
      child: Material(
        color: selected ? theme.colorScheme.primary.withValues(alpha: 0.10) : Colors.transparent,
        borderRadius: BorderRadius.circular(10),
        child: InkWell(
          borderRadius: BorderRadius.circular(10),
          onTap: () {
            setState(() => expandedMenuName = '');
            widget.onSelect?.call(path);
          },
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
            child: Row(
              children: [
                Icon(entry['icon'] as IconData, size: 19, color: selected ? theme.colorScheme.primary : theme.colorScheme.onSurfaceVariant),
                const SizedBox(width: 12),
                Expanded(child: Text(entry['menuName'] as String, style: theme.textTheme.bodyMedium?.copyWith(fontWeight: selected ? FontWeight.w600 : FontWeight.w400, color: selected ? theme.colorScheme.primary : null))),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
