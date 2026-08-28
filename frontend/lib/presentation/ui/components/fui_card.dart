import 'package:flutter/material.dart';

/// Shared ERP surface card following the responsive admin visual language.
class FCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final double? elevation;

  const FCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(20),
    this.elevation,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: elevation ?? 0,
      margin: EdgeInsets.zero,
      child: Padding(padding: padding, child: child),
    );
  }
}
