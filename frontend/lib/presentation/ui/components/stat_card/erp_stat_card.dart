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
    final content = Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: accent.withValues(alpha: .10),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: accent, size: 21),
            ),
            const Spacer(),
            if (trendLabel != null)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                decoration: BoxDecoration(
                  color: accent.withValues(alpha: .10),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(trendLabel!, style: theme.textTheme.labelSmall?.copyWith(color: accent, fontWeight: FontWeight.w600)),
              )
            else if (trailing != null)
              trailing!
          ]),
          const SizedBox(height: 20),
          Text(title, style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w500)),
          const SizedBox(height: 7),
          if (loading)
            const SizedBox(width: 90, height: 28, child: LinearProgressIndicator())
          else
            Text(value, maxLines: 2, overflow: TextOverflow.ellipsis, style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
          if (subtitle != null) ...[
            const SizedBox(height: 7),
            Text(subtitle!, maxLines: 2, overflow: TextOverflow.ellipsis, style: theme.textTheme.bodySmall),
          ],
        ],
      ),
    );
    final card = Card(child: content);
    if (onTap == null) return card;
    return InkWell(borderRadius: BorderRadius.circular(10), onTap: onTap, child: card);
  }
}
