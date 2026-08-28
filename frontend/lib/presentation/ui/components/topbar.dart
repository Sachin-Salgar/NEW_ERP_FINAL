import 'package:flutter/material.dart';

import 'responsive.dart';

class TopBar extends StatelessWidget implements PreferredSizeWidget {
  final List<Widget>? actions;
  final String title;
  final VoidCallback? onMenuPressed;

  const TopBar({
    super.key,
    this.actions,
    this.title = '',
    this.onMenuPressed,
  });

  @override
  Size get preferredSize => const Size.fromHeight(76);

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isMobile = ErpResponsive.isMobile(context);
    final isDesktop = ErpResponsive.isDesktop(context);

    return Row(
      children: [
        Builder(
          builder: (context) => IconButton(
            tooltip: isDesktop ? 'Collapse navigation' : 'Open navigation',
            icon: const Icon(Icons.menu_rounded),
            onPressed: onMenuPressed ??
                () {
                  Scaffold.of(context).openDrawer();
                },
          ),
        ),
        if (!isMobile) ...[
          Padding(
            padding: const EdgeInsets.only(left: 8),
            child: Text(
              title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: theme.textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          Spacer(flex: isDesktop ? 2 : 1),
        ],
        Expanded(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
            child: _TemplateSearchField(),
          ),
        ),
        if (actions != null)
          Padding(
            padding: const EdgeInsets.only(left: 4, right: 12),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: actions!,
            ),
          ),
      ],
    );
  }
}

/// Search follows the upstream Header: it remains visible at every width and
/// expands into the space left by the title/menu/profile controls.
class _TemplateSearchField extends StatelessWidget {
  const _TemplateSearchField();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return TextField(
      textInputAction: TextInputAction.search,
      decoration: InputDecoration(
        hintText: 'Search',
        filled: true,
        fillColor: theme.colorScheme.surfaceContainerHighest,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide.none,
        ),
        suffixIcon: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 5),
          child: Material(
            color: theme.colorScheme.primary,
            borderRadius: BorderRadius.circular(10),
            child: IconButton(
              tooltip: 'Search',
              icon: const Icon(Icons.search_rounded, size: 20),
              color: theme.colorScheme.onPrimary,
              onPressed: () {},
            ),
          ),
        ),
      ),
    );
  }
}
