import 'package:flutter/material.dart';

class ErpStatCard extends StatelessWidget {
  final String title;
  final String value;
  final IconData icon;
  final String? subtitle;
  final Color? accentColor;
  final Widget? trailing;
  final String? trendLabel;
  final bool loading;
  final VoidCallback? onTap;

  const ErpStatCard({
    super.key,
    required this.title,
    required this.value,
    required this.icon,
    this.subtitle,
    this.accentColor,
    this.trailing,
    this.trendLabel,
    this.loading = false,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final accent = accentColor ?? theme.colorScheme.primary;
    final card = Card(
      margin: EdgeInsets.zero,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final compact = constraints.maxWidth < 220;
          final veryCompact = constraints.maxWidth < 170;
          final padding = veryCompact
              ? 8.0
              : compact
                  ? 10.0
                  : 14.0;
          final iconSize = veryCompact
              ? 32.0
              : compact
                  ? 34.0
                  : 38.0;
          final valueStyle = veryCompact
              ? theme.textTheme.titleLarge
              : compact
                  ? theme.textTheme.titleLarge
                  : theme.textTheme.headlineSmall;

          return Padding(
            padding: EdgeInsets.all(padding),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: iconSize,
                      height: iconSize,
                      padding: EdgeInsets.all(veryCompact ? 6 : 7),
                      decoration: BoxDecoration(
                        color: accent.withValues(alpha: .10),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(
                        icon,
                        color: accent,
                        size: veryCompact ? 17 : 19,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Align(
                        alignment: Alignment.centerRight,
                        child: _trailing(context, theme, accent),
                      ),
                    ),
                  ],
                ),
                SizedBox(height: veryCompact ? 7 : compact ? 8 : 12),
                Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 4),
                if (loading)
                  const SizedBox(
                    width: double.infinity,
                    height: 5,
                    child: LinearProgressIndicator(),
                  )
                else
                  Text(
                    value,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: valueStyle?.copyWith(fontWeight: FontWeight.w700),
                  ),
                if (subtitle != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    subtitle!,
                    maxLines: veryCompact ? 2 : 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodySmall,
                  ),
                ],
              ],
            ),
          );
        },
      ),
    );
    if (onTap == null) return card;
    return InkWell(
      borderRadius: BorderRadius.circular(10),
      onTap: onTap,
      child: card,
    );
  }

  Widget _trailing(BuildContext context, ThemeData theme, Color accent) {
    if (trendLabel != null) {
      return Container(
        constraints: const BoxConstraints(maxWidth: 90),
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: accent.withValues(alpha: .10),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Text(
          trendLabel!,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: theme.textTheme.labelSmall?.copyWith(
            color: accent,
            fontWeight: FontWeight.w600,
          ),
        ),
      );
    }

    return trailing ??
        Icon(
          Icons.more_vert_rounded,
          size: 20,
          color: theme.colorScheme.onSurfaceVariant,
        );
  }
}
