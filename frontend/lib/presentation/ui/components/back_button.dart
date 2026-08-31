import 'package:flutter/material.dart';

/// Consistent back button component for Settings detail pages.
/// Provides standardized UI, UX, positioning, styling across all Settings screens.
class SettingsBackButton extends StatelessWidget {
  final VoidCallback? onPressed;
  final String? parentRoute;
  final String? label;

  const SettingsBackButton({
    super.key,
    this.onPressed,
    this.parentRoute,
    this.label = 'Back',
  });

  void _handleBack(BuildContext context) {
    if (onPressed != null) {
      onPressed!.call();
      return;
    }

    final target = parentRoute;
    if (target != null && target.isNotEmpty) {
      final navigator = Navigator.of(context);
      if (navigator.canPop()) {
        navigator.pop();
      }
      navigator.pushNamed(target);
      return;
    }

    if (Navigator.of(context).canPop()) {
      Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 112),
      child: TextButton.icon(
        onPressed: () => _handleBack(context),
        style: TextButton.styleFrom(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
          minimumSize: Size.zero,
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        ),
        icon: const Icon(Icons.arrow_back, size: 18),
        label: Text(label ?? 'Back'),
      ),
    );
  }
}
