import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import '../../../core/auth/auth_service.dart';
import '../../../routing/router.dart';

class Sidebar extends StatefulWidget {
  final String selectedRoute;
  final ValueChanged<String>? onSelect;

  const Sidebar({Key? key, required this.selectedRoute, this.onSelect}) : super(key: key);

  @override
  State<Sidebar> createState() => _SidebarState();
}

class _SidebarState extends State<Sidebar> {
  final ValueNotifier<String> expandedMenuName = ValueNotifier('');

  final List<Map<String, dynamic>> _menuGroups = [
    {
      'groupName': 'General',
      'menuList': [
        {
          'menuName': 'Dashboard',
          'path': '/dashboard',
          'icon': Icons.dashboard,
          'permissionKey': null,
          'moduleCode': 'core',
        },
      ],
    },
    {
      'groupName': 'Management',
      'menuList': [
        {
          'menuName': 'Organizations',
          'path': '/organizations',
          'icon': Icons.apartment,
          'permissionKey': AppRouter.routePermissions['/organizations'],
          'moduleCode': 'organization',
          'childList': null,
        },
        {
          'menuName': 'Branches',
          'path': '/organizations/branches',
          'icon': Icons.store,
          'permissionKey': AppRouter.routePermissions['/organizations/branches'],
          'moduleCode': 'branch',
          'childList': null,
        },
        {
          'menuName': 'Users',
          'path': '/users',
          'icon': Icons.people,
          'permissionKey': AppRouter.routePermissions['/users'],
          'moduleCode': 'user-management',
          'childList': null,
        },
        {
          'menuName': 'Roles',
          'path': '/roles',
          'icon': Icons.admin_panel_settings,
          'permissionKey': AppRouter.routePermissions['/roles'],
          'moduleCode': 'security',
          'childList': null,
        },
        {
          'menuName': 'Permissions',
          'path': '/permissions',
          'icon': Icons.lock_outline,
          'permissionKey': AppRouter.routePermissions['/permissions'],
          'moduleCode': 'security',
          'childList': null,
        },
      ],
    },
  ];

  List<Map<String, dynamic>> _visibleMenuGroups(AuthService auth) {
    final visibleGroups = <Map<String, dynamic>>[];

    for (final group in _menuGroups) {
      final menuList = (group['menuList'] as List<dynamic>).where((entry) {
        final permissionKey = entry['permissionKey'] as String?;
        final moduleCode = entry['moduleCode'] as String?;
        final moduleEnabled = moduleCode == null || auth.hasModule(moduleCode);
        final permissionAllowed = permissionKey == null || auth.hasPermission(permissionKey);
        return moduleEnabled && permissionAllowed;
      }).toList();

      if (menuList.isEmpty) continue;
      visibleGroups.add({...group, 'menuList': menuList});
    }

    return visibleGroups;
  }

  bool _isSelectedPath(BuildContext context, String path) {
    final routePath = ModalRoute.of(context)?.settings.name;
    return routePath == path || (routePath != null && routePath.endsWith(path));
  }

  Widget _buildMenuItem(BuildContext context, Map<String, dynamic> e) {
    final String itemName = e['menuName'] ?? '';
    final List? childList = e['childList'];
    final String path = e['path'] ?? '';
    final bool isSelected = childList == null || childList.isEmpty ? _isSelectedPath(context, path) : false;

    return Column(
      children: [
        InkWell(
          onTap: () {
            if (childList != null && childList.isNotEmpty) {
              expandedMenuName.value = expandedMenuName.value == itemName ? '' : itemName;
            } else {
              expandedMenuName.value = '';
              if (widget.onSelect != null) widget.onSelect!(path);
            }
          },
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
            decoration: BoxDecoration(
              gradient: isSelected
                  ? LinearGradient(
                      colors: [
                        Theme.of(context).colorScheme.primary.withValues(alpha: 0.08),
                        Theme.of(context).colorScheme.primary.withValues(alpha: 0.02),
                      ],
                    )
                  : null,
            ),
            child: Row(
              children: [
                if (e['icon'] != null)
                  Icon(
                    e['icon'] as IconData,
                    size: 18,
                    color: isSelected ? Theme.of(context).colorScheme.primary : Theme.of(context).textTheme.bodyLarge?.color,
                  ),
                const SizedBox(width: 12),
                Expanded(child: Text(itemName, style: Theme.of(context).textTheme.bodyLarge)),
                if (childList != null && childList.isNotEmpty)
                  ValueListenableBuilder<String>(
                    valueListenable: expandedMenuName,
                    builder: (ctx, menuName, child) {
                      final expanded = menuName == itemName;
                      return Icon(expanded ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down, size: 18);
                    },
                  ),
              ],
            ),
          ),
        ),
        if (childList != null && childList.isNotEmpty)
          ValueListenableBuilder<String>(
            valueListenable: expandedMenuName,
            builder: (ctx, menuName, child) {
              if (menuName != itemName) return const SizedBox.shrink();
              return Column(
                children: childList.map<Widget>((ch) {
                  final bool selected = _isSelectedPath(context, ch['path'] ?? '');
                  return InkWell(
                    onTap: () {
                      expandedMenuName.value = '';
                      if (widget.onSelect != null) widget.onSelect!(ch['path']);
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 28),
                      color: selected ? Theme.of(context).colorScheme.primary.withValues(alpha: 0.04) : Colors.transparent,
                      child: Row(
                        children: [
                          Expanded(child: Text(ch['menuName'], style: Theme.of(context).textTheme.bodyMedium)),
                        ],
                      ),
                    ),
                  );
                }).toList(),
              );
            },
          ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = GetIt.instance.get<AuthService>();
    final visibleGroups = _visibleMenuGroups(auth);

    return Container(
      width: 260,
      color: Theme.of(context).canvasColor,
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.all(16.0),
              child: Text('NEW ERP', style: Theme.of(context).textTheme.titleLarge),
            ),
            const Divider(height: 1),
            Expanded(
              child: ListView(
                padding: EdgeInsets.zero,
                children: visibleGroups.map<Widget>((group) {
                  final String groupName = group['groupName'] ?? '';
                  final List menuList = group['menuList'] ?? [];
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 8.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (groupName.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 8.0),
                            child: Text(groupName, style: Theme.of(context).textTheme.titleSmall),
                          ),
                        ...menuList.map<Widget>((e) => _buildMenuItem(context, e as Map<String, dynamic>)).toList(),
                        const SizedBox(height: 8),
                      ],
                    ),
                  );
                }).toList(),
              ),
            ),
            const Divider(height: 1),
            Padding(
              padding: const EdgeInsets.all(8.0),
              child: Text('v0.1.0', textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodySmall),
            ),
          ],
        ),
      ),
    );
  }
}