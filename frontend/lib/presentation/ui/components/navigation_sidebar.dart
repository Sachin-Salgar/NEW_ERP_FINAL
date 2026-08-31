import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import '../../../core/auth/auth_service.dart';
import '../../../routing/route_config.dart';

class Sidebar extends StatelessWidget {
  final String selectedRoute;
  final ValueChanged<String>? onSelect;
  final bool collapsed;

  const Sidebar({
    super.key,
    required this.selectedRoute,
    this.onSelect,
    this.collapsed = false,
  });

  List<AppRouteConfig> _visibleItems(AuthService auth) {
    return AppRoutes.topLevel.where((item) {
      final permission = item.permissionKey;
      final module = item.moduleCode;
      return (module == null || auth.hasModule(module)) &&
          (permission == null || auth.hasPermission(permission));
    }).toList(growable: false);
  }

  bool _selected(AppRouteConfig item) => item.matches(selectedRoute);

  @override
  Widget build(BuildContext context) {
    final auth = GetIt.instance.get<AuthService>();
    final theme = Theme.of(context);
    final groups = <String, List<AppRouteConfig>>{};
    for (final item in _visibleItems(auth)) {
      groups.putIfAbsent(item.group, () => []).add(item);
    }

    return Container(
      margin: const EdgeInsets.all(12),
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        border: Border(right: BorderSide(color: theme.dividerColor)),
        borderRadius: BorderRadius.circular(18),
      ),
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: EdgeInsets.fromLTRB(collapsed ? 12 : 16, 22, collapsed ? 12 : 16, 20),
              child: Row(
                mainAxisAlignment: collapsed ? MainAxisAlignment.center : MainAxisAlignment.start,
                children: [
                  Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(color: theme.colorScheme.primary, borderRadius: BorderRadius.circular(10)),
                    child: Icon(Icons.grid_view_rounded, color: theme.colorScheme.onPrimary, size: 21),
                  ),
                  if (!collapsed) ...[
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text('NEW ERP', maxLines: 1, overflow: TextOverflow.ellipsis, style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w600)),
                    ),
                  ],
                ],
              ),
            ),
            Divider(height: 1, color: theme.dividerColor),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(vertical: 12),
                children: groups.entries.map((entry) {
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (!collapsed)
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                          child: Text(entry.key, style: theme.textTheme.labelSmall?.copyWith(letterSpacing: 1.1, fontWeight: FontWeight.w600)),
                        ),
                      ...entry.value.map((item) {
                        final selected = _selected(item);
                        final tile = Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          child: Material(
                            color: selected ? theme.colorScheme.primary.withValues(alpha: 0.10) : Colors.transparent,
                            borderRadius: BorderRadius.circular(10),
                            child: InkWell(
                              borderRadius: BorderRadius.circular(10),
                              onTap: () => onSelect?.call(item.path),
                              child: Padding(
                                padding: EdgeInsets.symmetric(horizontal: collapsed ? 0 : 10, vertical: 11),
                                child: Row(
                                  mainAxisAlignment: collapsed ? MainAxisAlignment.center : MainAxisAlignment.start,
                                  children: [
                                    Icon(item.icon, size: 19, color: selected ? theme.colorScheme.primary : theme.colorScheme.onSurfaceVariant),
                                    if (!collapsed) ...[
                                      const SizedBox(width: 10),
                                      Expanded(
                                        child: Text(item.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: theme.textTheme.bodyMedium?.copyWith(fontWeight: selected ? FontWeight.w600 : FontWeight.w400, color: selected ? theme.colorScheme.primary : null)),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                            ),
                          ),
                        );
                        return collapsed ? Tooltip(message: item.title, child: tile) : tile;
                      }),
                      const SizedBox(height: 10),
                    ],
                  );
                }).toList(),
              ),
            ),
            if (!collapsed) ...[
              Divider(height: 1, color: theme.dividerColor),
              Padding(
                padding: const EdgeInsets.all(12),
                child: Text('NEW ERP • CORE', textAlign: TextAlign.center, maxLines: 1, overflow: TextOverflow.ellipsis, style: theme.textTheme.labelSmall),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
