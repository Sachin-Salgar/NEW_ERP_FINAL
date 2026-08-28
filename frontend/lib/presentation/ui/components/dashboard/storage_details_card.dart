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
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Storage Details', style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w600)),
            const SizedBox(height: 14),
            const Center(child: _StorageChart()),
            const SizedBox(height: 18),
            ..._items.map((item) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _StorageRow(item: item),
                )),
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
    return SizedBox(
      width: 230,
      height: 230,
      child: CustomPaint(
        painter: _StorageChartPainter(Theme.of(context).colorScheme),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('29.1', style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w700)),
              Text('of 128GB', style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
            ],
          ),
        ),
      ),
    );
  }
}

class _StorageChartPainter extends CustomPainter {
  const _StorageChartPainter(this.scheme);

  final ColorScheme scheme;

  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    final radius = math.min(size.width, size.height) / 2 - 8;
    final stroke = 28.0;
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
      canvas.drawArc(Rect.fromCircle(center: center, radius: radius), start, sweep, false, paint);
      start += sweep + .02;
    }
  }

  @override
  bool shouldRepaint(covariant _StorageChartPainter oldDelegate) => oldDelegate.scheme != scheme;
}

class _StorageRow extends StatelessWidget {
  const _StorageRow({required this.item});

  final _StorageItem item;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      constraints: const BoxConstraints(minHeight: 76),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface.withValues(alpha: .35),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: theme.colorScheme.primary.withValues(alpha: .25), width: 1.5),
      ),
      child: Row(
        children: [
          Icon(item.icon, color: theme.colorScheme.primary, size: 24),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item.name, style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
                const SizedBox(height: 2),
                Text(item.count, style: theme.textTheme.bodySmall),
              ],
            ),
          ),
          Text(item.size, style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
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
