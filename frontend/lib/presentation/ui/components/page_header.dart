import 'package:flutter/material.dart';

class ErpBreadcrumbItem {
  final String label;
  final String? route;
  const ErpBreadcrumbItem({required this.label, this.route});
}

class ErpBreadcrumbs extends StatelessWidget {
  final List<ErpBreadcrumbItem> items;
  const ErpBreadcrumbs({super.key, required this.items});

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const SizedBox.shrink();
    final theme = Theme.of(context);
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(children: [
        for (var i = 0; i < items.length; i++) ...[
          if (i > 0) Icon(Icons.chevron_right, size: 16, color: theme.colorScheme.onSurfaceVariant),
          Text(items[i].label, style: theme.textTheme.bodySmall?.copyWith(fontWeight: i == items.length - 1 ? FontWeight.w600 : FontWeight.w400)),
        ],
      ]),
    );
  }
}

class ErpPageHeader extends StatelessWidget {
  final String title;
  final String? subtitle;
  final List<ErpBreadcrumbItem>? breadcrumbs;
  final List<Widget>? actions;
  final bool divider;

  const ErpPageHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.breadcrumbs,
    this.actions,
    this.divider = false,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 4, 4, 8),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        if (breadcrumbs != null) ErpBreadcrumbs(items: breadcrumbs!),
        const SizedBox(height: 8),
        LayoutBuilder(builder: (context, constraints) {
          final compact = constraints.maxWidth < 650;
          final heading = Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
            if (subtitle != null) ...[
              const SizedBox(height: 4),
              Text(subtitle!, style: theme.textTheme.bodyMedium),
            ],
          ]);
          if (actions == null || actions!.isEmpty) return heading;
          final buttons = Wrap(spacing: 8, runSpacing: 8, children: actions!);
          return compact ? Column(crossAxisAlignment: CrossAxisAlignment.start, children: [heading, const SizedBox(height: 12), buttons]) : Row(children: [Expanded(child: heading), buttons]);
        }),
        if (divider) const Padding(padding: EdgeInsets.only(top: 14), child: Divider()),
      ]),
    );
  }
}
