import 'package:flutter/material.dart';

import '../presentation/ui/components/settings_sidebar.dart';

class SettingsShell extends StatelessWidget {
  final String selectedRoute;
  final Widget child;
  final ValueChanged<String>? onSelect;

  const SettingsShell({
    super.key,
    required this.selectedRoute,
    required this.child,
    this.onSelect,
  });

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final isDesktop = width >= 1100;

    if (isDesktop) {
      return Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SettingsSidebar(selectedRoute: selectedRoute, onSelect: onSelect),
          Expanded(child: child),
        ],
      );
    }

    return Column(
      children: [
        SettingsSidebar(selectedRoute: selectedRoute, onSelect: onSelect, compact: true),
        Expanded(child: child),
      ],
    );
  }
}
