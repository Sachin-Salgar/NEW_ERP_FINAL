import 'package:flutter/material.dart';

class ErpBreadcrumbItem {
  final String label;
  final String? route;

  const ErpBreadcrumbItem({required this.label, this.route});
}

class ErpBreadcrumbs extends StatelessWidget {
  final List<ErpBreadcrumbItem> items;
  final EdgeInsetsGeometry padding;

  const ErpBreadcrumbs({
    Key? key,
    required this.items,
    this.padding = const EdgeInsets.symmetric(vertical: 4.0),
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const SizedBox.shrink();

    final children = <Widget>[];
    for (var i = 0; i < items.length; i++) {
      final it = items[i];
      final isLast = i == items.length - 1;
      Widget label = Text(
        it.label,
        style: isLast
            ? Theme.of(context).textTheme.bodyLarge
                  ?.copyWith(fontWeight: FontWeight.w700)
            : Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Theme.of(context).textTheme.bodySmall?.color
                    ?.withValues(alpha: 0.8),
              ),
        overflow: TextOverflow.ellipsis,
      );

      if (it.route != null && !isLast) {
        label = InkWell(
          onTap: () => Navigator.of(context).pushNamed(it.route!),
          child: label,
        );
      }

      children.add(label);

      if (!isLast) {
        children.add(
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 6.0),
            child: Icon(
              Icons.chevron_right,
              size: 16,
              color: Theme.of(context).textTheme.bodySmall?.color
                  ?.withValues(alpha: 0.7),
            ),
          ),
        );
      }
    }

    return Padding(
      padding: padding,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final isNarrow = constraints.maxWidth < 360;
          final row = Row(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: children,
          );
          return isNarrow
              ? SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: row,
                )
              : row;
        },
      ),
    );
  }
}

class ErpPageHeader extends StatelessWidget {
  final String title;
  final String? subtitle;
  final List<ErpBreadcrumbItem>? breadcrumbs;
  final List<Widget>? actions;
  final EdgeInsetsGeometry padding;
  final bool divider;

  const ErpPageHeader({
    Key? key,
    required this.title,
    this.subtitle,
    this.breadcrumbs,
    this.actions,
    this.padding = const EdgeInsets.symmetric(vertical: 12.0, horizontal: 16.0),
    this.divider = true,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final titleWidget = Text(
      title,
      style: Theme.of(context).textTheme.headlineSmall
          ?.copyWith(fontWeight: FontWeight.w700),
    );
    final subtitleWidget = subtitle != null
        ? Padding(
            padding: const EdgeInsets.only(top: 6.0),
            child: Text(
              subtitle!,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          )
        : null;

    final actionsWidget = actions != null
        ? Wrap(
            spacing: 8,
            runSpacing: 6,
            alignment: WrapAlignment.end,
            children: actions!,
          )
        : const SizedBox.shrink();

    return Padding(
      padding: padding,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (breadcrumbs != null && breadcrumbs!.isNotEmpty)
            ErpBreadcrumbs(items: breadcrumbs!),
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    titleWidget,
                    if (subtitleWidget != null) subtitleWidget,
                  ],
                ),
              ),
              ConstrainedBox(
                constraints: BoxConstraints(maxWidth: 420),
                child: Align(
                  alignment: Alignment.centerRight,
                  child: actionsWidget,
                ),
              ),
            ],
          ),
          if (divider)
            const Padding(
              padding: EdgeInsets.only(top: 12.0),
              child: Divider(height: 1),
            ),
        ],
      ),
    );
  }
}
