import 'package:flutter/material.dart';

class FCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final double elevation;

  const FCard({
    Key? key,
    required this.child,
    this.padding = const EdgeInsets.all(12.0),
    this.elevation = 0.6,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: elevation,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8.0)),
      child: Padding(padding: padding, child: child),
    );
  }
}
