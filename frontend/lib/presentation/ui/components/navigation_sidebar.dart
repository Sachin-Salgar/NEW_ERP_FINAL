import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import '../../../core/auth/auth_service.dart';

class Sidebar extends StatelessWidget {
  final String selectedRoute;
  final ValueChanged<String>? onSelect;

  const Sidebar({super.key, required this.selectedRoute, this.onSelect});

  List<Map<String, dynamic>> _groups(AuthService auth) {
    final groups = [
      {
        'title': 'GENERAL',
        'items': [
          {'label': 'Dashboard', 'path': '/dashboard', 'icon': Icons.dashboard_outlined, 'permission': null, 'module': 'core'},
        ],
      },
      {
        'title': 'MANAGEMENT',
        'items': [
          {'label': 'Organizations', 'path': '/organizations', 'icon': Icons.apartment_outlined, 'permission': 'organization.read', 'module': 'organization'},
          {'label': 'Branches', 'path': '/organizations/branches', 'icon': Icons.store_outlined, 'permission': 'branch.read', 'module': 'branch'},
          {'label': 'Users', 'path': '/users', 'icon': Icons.people_outline, 'permission': 'user.read', 'module': 'user-management'},
          {'label': 'Roles', 'path': '/roles', 'icon': Icons.admin_panel_settings_outlined, 'permission': 'role.read', 'module': 'security'},
          {'label': 'Permissions', 'path': '/permissions', 'icon': Icons.lock_outline, 'permission': 'permission.read', 'module': 'security'},
        ],
      },
    ];
    return groups.map((group) {
      final items = (group['items'] as List<Map<String, dynamic>>).where((item) {
        final permission = item['permission'] as String?;
        final module = item['module'] as String?;
        return (module == null || auth.hasModule(module)) && (permission == null || auth.hasPermission(permission));
      }).toList();
      return {...group, 'items': items};
    }).where((group) => (group['items'] as List).isNotEmpty).toList();
  }

  bool _selected(String path) => selectedRoute == path || selectedRoute.startsWith('$path/');

  @override
  Widget build(BuildContext context) {
    final auth = GetIt.instance.get<AuthService>();
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
              child: Row(children: [
                Container(width: 38, height: 38,
                  decoration: BoxDecoration(color: theme.colorScheme.primary, borderRadius: BorderRadius.circular(10)),
                  child: Icon(Icons.grid_view_rounded, color: theme.colorScheme.onPrimary, size: 21)),
                const SizedBox(width: 12),
                Text('NEW ERP', style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w600)),
              ]),
            ),
            Divider(height: 1, color: theme.dividerColor),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(vertical: 12),
                children: _groups(auth).map((group) {
                  final items = group['items'] as List<Map<String, dynamic>>;
                  return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(20, 12, 20, 8),
                      child: Text(group['title'] as String, style: theme.textTheme.labelSmall?.copyWith(letterSpacing: 1.1, fontWeight: FontWeight.w600)),
                    ),
                    ...items.map((item) {
                      final selected = _selected(item['path'] as String);
                      return Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
                        child: Material(
                          color: selected ? theme.colorScheme.primary.withValues(alpha: 0.10) : Colors.transparent,
                          borderRadius: BorderRadius.circular(10),
                          child: InkWell(
                            borderRadius: BorderRadius.circular(10),
                            onTap: () => onSelect?.call(item['path'] as String),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
                              child: Row(children: [
                                Icon(item['icon'] as IconData, size: 19, color: selected ? theme.colorScheme.primary : theme.colorScheme.onSurfaceVariant),
                                const SizedBox(width: 12),
                                Expanded(child: Text(item['label'] as String, style: theme.textTheme.bodyMedium?.copyWith(fontWeight: selected ? FontWeight.w600 : FontWeight.w400, color: selected ? theme.colorScheme.primary : null))),
                              ]),
                            ),
                          ),
                        ),
                      );
                    }),
                    const SizedBox(height: 10),
                  ]);
                }).toList(),
              ),
            ),
            Divider(height: 1, color: theme.dividerColor),
            Padding(padding: const EdgeInsets.all(12), child: Text('NEW ERP • CORE', textAlign: TextAlign.center, style: theme.textTheme.labelSmall)),
          ],
        ),
      ),
    );
  }
}
