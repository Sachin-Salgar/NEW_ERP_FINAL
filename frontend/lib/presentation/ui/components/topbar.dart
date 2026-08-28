import 'package:flutter/material.dart';

import '../../../widgets/theme_mode_button.dart';
import 'responsive.dart';

class TopBar extends StatelessWidget implements PreferredSizeWidget {
  final List<Widget>? actions;
  final String title;

  const TopBar({super.key, this.actions, this.title = ''});

  @override
  Size get preferredSize => const Size.fromHeight(76);

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final width = MediaQuery.sizeOf(context).width;
    final isMobile = ErpResponsive.isMobile(context);
    final showSearch = width >= 600;

    return Container(
      height: preferredSize.height,
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        border: Border(bottom: BorderSide(color: theme.dividerColor)),
      ),
      child: Row(
        children: [
          if (width < 1100)
            Padding(
              padding: EdgeInsets.only(left: isMobile ? 4 : 8),
              child: Builder(
                builder: (context) => IconButton(
                  tooltip: 'Open navigation',
                  icon: const Icon(Icons.menu_rounded),
                  onPressed: () => Scaffold.of(context).openDrawer(),
                ),
              ),
            ),
          if (!isMobile) ...[
            Padding(
              padding: const EdgeInsets.only(left: 24),
              child: Text(
                title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w600),
              ),
            ),
            const SizedBox(width: 24),
          ],
          if (showSearch)
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                child: _TemplateSearchField(),
              ),
            )
          else
            const Spacer(),
          Padding(
            padding: EdgeInsets.symmetric(horizontal: isMobile ? 4 : 8),
            child: const ThemeModeButton(),
          ),
          if (actions != null)
            Padding(
              padding: EdgeInsets.only(right: isMobile ? 8 : 16, left: 4),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: actions!,
              ),
            ),
        ],
      ),
    );
  }
}

/// Search field follows the upstream template's visual pattern: a soft
/// filled field with a compact primary search action on the right.
class _TemplateSearchField extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 520),
      child: TextField(
        textInputAction: TextInputAction.search,
        decoration: InputDecoration(
          hintText: 'Search',
          prefixIcon: const Icon(Icons.search_rounded, size: 20),
          suffixIcon: Padding(
            padding: const EdgeInsets.all(5),
            child: Material(
              color: theme.colorScheme.primary,
              borderRadius: BorderRadius.circular(8),
              child: IconButton(
                tooltip: 'Search',
                icon: const Icon(Icons.search_rounded, size: 18),
                color: theme.colorScheme.onPrimary,
                onPressed: () {},
              ),
            ),
          ),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: BorderSide.none,
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: BorderSide.none,
          ),
        ),
      ),
    );
  }
}
