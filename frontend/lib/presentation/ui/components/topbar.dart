import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../themes/theme_controller.dart';
import '../../../widgets/theme_mode_button.dart';
import 'responsive.dart';

enum _ThemeMenuAction { toggle }

class TopBar extends StatelessWidget implements PreferredSizeWidget {
  final List<Widget>? actions;
  final String title;

  const TopBar({super.key, this.actions, this.title = ''});

  @override
  Size get preferredSize => const Size.fromHeight(72);

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isMobile = ErpResponsive.isMobile(context);

    return Container(
      height: preferredSize.height,
      padding: EdgeInsets.symmetric(horizontal: isMobile ? 12 : 24),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        border: Border(bottom: BorderSide(color: theme.dividerColor)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w600),
            ),
          ),
          if (MediaQuery.sizeOf(context).width >= 1000) ...[
            SizedBox(
              width: 280,
              height: 42,
              child: TextField(
                textInputAction: TextInputAction.search,
                decoration: const InputDecoration(
                  hintText: 'Search',
                  prefixIcon: Icon(Icons.search, size: 20),
                ),
              ),
            ),
            const SizedBox(width: 12),
          ],
          if (isMobile)
            _MobileThemeMenu()
          else
            const ThemeModeButton(),
          if (actions != null) ...actions!,
        ],
      ),
    );
  }
}

class _MobileThemeMenu extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final controller = context.watch<ThemeController>();
    final dark = controller.isDark;

    return PopupMenuButton<_ThemeMenuAction>(
      tooltip: 'Theme options',
      icon: const Icon(Icons.more_vert),
      onSelected: (action) {
        if (action == _ThemeMenuAction.toggle) {
          controller.toggle();
        }
      },
      itemBuilder: (context) => [
        PopupMenuItem<_ThemeMenuAction>(
          value: _ThemeMenuAction.toggle,
          child: Row(
            children: [
              Icon(dark ? Icons.light_mode_outlined : Icons.dark_mode_outlined),
              const SizedBox(width: 12),
              Text(dark ? 'Switch to light mode' : 'Switch to dark mode'),
            ],
          ),
        ),
      ],
    );
  }
}
