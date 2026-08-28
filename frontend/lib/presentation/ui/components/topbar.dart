import 'package:flutter/material.dart';

import '../../../widgets/theme_mode_button.dart';
import 'responsive.dart';

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
          // Theme is icon-only on every responsive breakpoint.
          const ThemeModeButton(),
          if (actions != null) ...actions!,
        ],
      ),
    );
  }
}
