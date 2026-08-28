import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../themes/theme_controller.dart';

class ThemeModeButton extends StatelessWidget {
  final bool showLabel;

  const ThemeModeButton({super.key, this.showLabel = false});

  @override
  Widget build(BuildContext context) {
    final controller = context.watch<ThemeController>();
    final dark = controller.isDark;
    final icon = dark ? Icons.light_mode_outlined : Icons.dark_mode_outlined;
    final label = dark ? 'Switch to light mode' : 'Switch to dark mode';

    if (showLabel) {
      return ListTile(
        leading: Icon(icon),
        title: Text(dark ? 'Light mode' : 'Dark mode'),
        subtitle: Text('Currently ${dark ? 'dark' : 'light'}'),
        onTap: () => controller.toggle(),
      );
    }

    return IconButton(
      tooltip: label,
      onPressed: () => controller.toggle(),
      icon: AnimatedSwitcher(
        duration: const Duration(milliseconds: 180),
        child: Icon(icon, key: ValueKey(dark)),
      ),
    );
  }
}
