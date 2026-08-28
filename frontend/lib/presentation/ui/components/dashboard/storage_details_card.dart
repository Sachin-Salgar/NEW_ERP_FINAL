import 'dart:math' as math;

import 'package:flutter/material.dart';

class StorageDetailsCard extends StatelessWidget {
  const StorageDetailsCard({super.key});

  static const _items = <_StorageItem>[
    _StorageItem('Documents Files', '1328 Files', '1.3GB', Icons.description_outlined),
    _StorageItem('Media Files', '1328 Files', '15.3GB', Icons.smart_display_outlined),
    _StorageItem('Other Files', '1328 Files', '1.3GB', Icons.folder_outlined),
    _StorageItem('Unknown', '140 Files', '1.3GB', Icons.insert_drive_file_outlined),
  ];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Storage Details',
              style: theme.textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 16),
            const _StorageChart(),
            const SizedBox(height: 16),
            ..._items.map(
              (item) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: _StorageRow(item: item),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StorageChart extends StatelessWidget {
  const _StorageChart();

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        // The upstream chart is 200px tall and takes the available width.
        // Constrain our custom painter to the storage column so it can shrink
        // when the proportional 5/7 : 2/7 dashboard split gets narrow.
        final size = math.min(230.0, constraints.maxWidth);
        return Center(
          child: SizedBox(
            width: size,
            height: size,
            child: CustomPaint(
              painter: _StorageChartPainter(
                Theme.of(context).colorScheme,
              ),
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      '29.1',
                      style: Theme.of(context)
                          .textTheme
                          .headlineMedium
                          ?.copyWith(fontWeight: FontWeight.w700),
                    ),
                    Text(
                      'of 128GB',
                      style: Theme.of(context)
                          .textTheme
                          .bodyMedium
                          ?.copyWith(fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

class _StorageChartPainter extends CustomPainter {
  const _StorageChartPainter(this.scheme);

  final ColorScheme scheme;

  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    final radius = math.max(
      0.0,
      math.min(size.width, size.height) / 2 - 8,
    ).toDouble();
    final stroke = math.max(18.0, math.min(28.0, radius * .24)).toDouble();
    final background = Paint()
      ..color = scheme.primary.withValues(alpha: .12)
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke;
    canvas.drawCircle(center, radius, background);

    final colors = <Color>[
      scheme.primary,
      scheme.secondary,
      Colors.amber,
      scheme.error,
    ];
    final portions = <double>[.26, .22, .11, .10];
    var start = -math.pi / 2;
    for (var i = 0; i < portions.length; i++) {
      final paint = Paint()
        ..color = colors[i]
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..strokeCap = StrokeCap.butt;
      final sweep = portions[i] * math.pi * 2;
      canvas.drawArc(
        Rect.fromCircle(center: center, radius: radius),
        start,
        sweep,
        false,
        paint,
      );
      start += sweep + .02;
    }
  }

  @override
  bool shouldRepaint(covariant _StorageChartPainter oldDelegate) =>
      oldDelegate.scheme != scheme;
}

class _StorageRow extends StatelessWidget {
  const _StorageRow({required this.item});

  final _StorageItem item;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      constraints: const BoxConstraints(minHeight: 76),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface.withValues(alpha: .35),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: theme.colorScheme.primary.withValues(alpha: .25),
          width: 1.5,
        ),
      ),
      child: Row(
        children: [
          Icon(item.icon, color: theme.colorScheme.primary, size: 24),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  item.count,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodySmall,
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              item.size,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.end,
              style: theme.textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _StorageItem {
  const _StorageItem(this.name, this.count, this.size, this.icon);

  final String name;
  final String count;
  final String size;
  final IconData icon;
}
