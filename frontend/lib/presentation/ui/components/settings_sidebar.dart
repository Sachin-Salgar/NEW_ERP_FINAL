import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import '../../../core/auth/auth_service.dart';
import '../../../routing/route_config.dart';

class SettingsSidebar extends StatelessWidget {
  final String selectedRoute;
  final ValueChanged<String>? onSelect;
  final bool compact;

  const SettingsSidebar({
    super.key,
    required this.selectedRoute,
    this.onSelect,
    this.compact = false,
  });

  List<AppRouteConfig> _visibleItems(AuthService auth) {
    return AppRoutes.settingsNavigation.where((item) {
      final permission = item.permissionKey;
      final module = item.moduleCode;
      return (permission == null || auth.hasPermission(permission)) &&
          (module == null || auth.hasModule(module));
    }).toList(growable: false);
  }

  bool _selected(AppRouteConfig item) => item.matches(selectedRoute);

  @override
  Widget build(BuildContext context) {
    final auth = GetIt.instance.get<AuthService>();
    final theme = Theme.of(context);
    final items = _visibleItems(auth);

    if (compact) {
      return Container(
        margin: const EdgeInsets.all(12),
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: theme.colorScheme.surface,
          border: Border(bottom: BorderSide(color: theme.dividerColor)),
          borderRadius: BorderRadius.circular(18),
        ),
        child: SafeArea(
          bottom: false,
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: Row(
              children: items.map((item) {
                final selected = _selected(item);
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text(item.title),
                    selected: selected,
                    avatar: Icon(item.icon, size: 18),
                    onSelected: (_) => onSelect?.call(item.path),
                  ),
                );
              }).toList(),
            ),
          ),
        ),
      );
    }

    return Container(
      width: 260,
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
              padding: const EdgeInsets.fromLTRB(20, 18, 20, 12),
              child: Text(
                'Settings',
                style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
              ),
            ),
            Divider(height: 1, color: theme.dividerColor),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(vertical: 12),
                children: items.map((item) {
                  final selected = _selected(item);
                  return Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    child: Material(
                      color: selected ? theme.colorScheme.primary.withValues(alpha: 0.10) : Colors.transparent,
                      borderRadius: BorderRadius.circular(10),
                      child: InkWell(
                        borderRadius: BorderRadius.circular(10),
                        onTap: () => onSelect?.call(item.path),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                          child: Row(
                            children: [
                              Icon(
                                item.icon,
                                size: 18,
                                color: selected ? theme.colorScheme.primary : theme.colorScheme.onSurfaceVariant,
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  item.title,
                                  style: theme.textTheme.bodyMedium?.copyWith(
                                    fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                                    color: selected ? theme.colorScheme.primary : null,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
