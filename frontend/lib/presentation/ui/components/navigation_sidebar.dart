import 'package:flutter/material.dart';

class Sidebar extends StatefulWidget {
  final String selectedRoute;
  final ValueChanged<String>? onSelect;

  const Sidebar({Key? key, required this.selectedRoute, this.onSelect})
    : super(key: key);

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
          'childList': null,
        },
        {
          'menuName': 'Branches',
          'path': '/branches',
          'icon': Icons.store,
          'childList': null,
        },
        {
          'menuName': 'Users',
          'path': '/users',
          'icon': Icons.people,
          'childList': null,
        },
      ],
    },
  ];

  bool _isSelectedPath(BuildContext context, String path) {
    String? routePath = ModalRoute.of(context)?.settings.name;
    return routePath == path || (routePath != null && routePath.endsWith(path));
  }

  Widget _buildMenuItem(BuildContext context, Map<String, dynamic> e) {
    String itemName = e['menuName'] ?? '';
    List? childList = e['childList'];
    String path = e['path'] ?? '';
    bool isSelected = childList == null || childList.isEmpty
        ? _isSelectedPath(context, path)
        : false;

    return Column(
      children: [
        InkWell(
          onTap: () {
            if (childList != null && childList.isNotEmpty) {
              if (expandedMenuName.value == itemName) {
                expandedMenuName.value = '';
              } else {
                expandedMenuName.value = itemName;
              }
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
                        Theme.of(context).colorScheme.primary
                            .withValues(alpha: 0.08),
                        Theme.of(context).colorScheme.primary
                            .withValues(alpha: 0.02),
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
                    color: isSelected
                        ? Theme.of(context).colorScheme.primary
                        : Theme.of(context).textTheme.bodyLarge?.color,
                  ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    itemName,
                    style: Theme.of(context).textTheme.bodyLarge,
                  ),
                ),
                if (childList != null && childList.isNotEmpty)
                  ValueListenableBuilder<String>(
                    valueListenable: expandedMenuName,
                    builder: (ctx, menuName, child) {
                      bool expanded = menuName == itemName;
                      return Icon(
                        expanded
                            ? Icons.keyboard_arrow_up
                            : Icons.keyboard_arrow_down,
                        size: 18,
                      );
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
                  final bool selected = _isSelectedPath(
                    context,
                    ch['path'] ?? '',
                  );
                  return InkWell(
                    onTap: () {
                      expandedMenuName.value = '';
                      if (widget.onSelect != null) widget.onSelect!(ch['path']);
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        vertical: 10,
                        horizontal: 28,
                      ),
                      color: selected
                          ? Theme.of(context).colorScheme.primary
                                .withValues(alpha: 0.04)
                          : Colors.transparent,
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              ch['menuName'],
                              style: Theme.of(context).textTheme.bodyMedium,
                            ),
                          ),
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
    return Container(
      width: 260,
      color: Theme.of(context).canvasColor,
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.all(16.0),
              child: Text(
                'NEW ERP',
                style: Theme.of(context).textTheme.titleLarge,
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: ListView(
                padding: EdgeInsets.zero,
                children: _menuGroups.map<Widget>((group) {
                  final String groupName = group['groupName'] ?? '';
                  final List menuList = group['menuList'] ?? [];
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 8.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (groupName.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12.0,
                              vertical: 8.0,
                            ),
                            child: Text(
                              groupName,
                              style: Theme.of(context).textTheme.titleSmall,
                            ),
                          ),
                        ...menuList
                            .map<Widget>(
                              (e) => _buildMenuItem(
                                context,
                                e as Map<String, dynamic>,
                              ),
                            )
                            .toList(),
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
              child: Text(
                'v0.1.0',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
