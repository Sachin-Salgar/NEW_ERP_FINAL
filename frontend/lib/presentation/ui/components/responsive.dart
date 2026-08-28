import 'package:flutter/material.dart';

class ErpResponsive extends StatelessWidget {
  final Widget mobile;
  final Widget? tablet;
  final Widget desktop;

  const ErpResponsive({
    super.key,
    required this.mobile,
    this.tablet,
    required this.desktop,
  });

  static bool isMobile(BuildContext context) => MediaQuery.sizeOf(context).width < 850;

  static bool isTablet(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    return width >= 850 && width < 1100;
  }

  static bool isDesktop(BuildContext context) => MediaQuery.sizeOf(context).width >= 1100;

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    if (width >= 1100) return desktop;
    if (width >= 850 && tablet != null) return tablet!;
    return mobile;
  }
}
