import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

class StorageDetailsCard extends StatelessWidget {
  const StorageDetailsCard({super.key});

  static const _items = <_StorageItem>[
    _StorageItem(
      'Documents Files',
      '1328 Files',
      '1.3GB',
      Icons.description_outlined,
    ),
    _StorageItem(
      'Media Files',
      '1328 Files',
      '15.3GB',
      Icons.smart_display_outlined,
    ),
    _StorageItem(
      'Other Files',
      '1328 Files',
      '1.3GB',
      Icons.folder_outlined,
    ),
    _StorageItem(
      'Unknown',
      '140 Files',
      '1.3GB',
      Icons.insert_drive_file_outlined,
    ),
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

/// The upstream template uses fl_chart's PieChart rather than a custom
/// Canvas painter. In particular, each section has a different radius,
/// creating the characteristic stepped donut thickness visible in the
/// reference dashboard.
class _StorageChart extends StatelessWidget {
  const _StorageChart();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final primary = theme.colorScheme.primary;

    return SizedBox(
      height: 200,
      child: Stack(
        children: [
          PieChart(
            PieChartData(
              sectionsSpace: 0,
              centerSpaceRadius: 70,
              startDegreeOffset: -90,
              sections: [
                PieChartSectionData(
                  color: primary,
                  value: 25,
                  showTitle: false,
                  radius: 25,
                ),
                PieChartSectionData(
                  color: const Color(0xFF26E5FF),
                  value: 20,
                  showTitle: false,
                  radius: 22,
                ),
                PieChartSectionData(
                  color: const Color(0xFFFFCF26),
                  value: 10,
                  showTitle: false,
                  radius: 19,
                ),
                PieChartSectionData(
                  color: const Color(0xFFEE2727),
                  value: 15,
                  showTitle: false,
                  radius: 16,
                ),
                PieChartSectionData(
                  color: primary.withValues(alpha: 0.1),
                  value: 25,
                  showTitle: false,
                  radius: 13,
                ),
              ],
            ),
          ),
          Positioned.fill(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const SizedBox(height: 16),
                Text(
                  '29.1',
                  style: theme.textTheme.headlineMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                    height: 0.5,
                  ),
                ),
                Text(
                  'of 128GB',
                  style: theme.textTheme.bodyMedium,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
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
