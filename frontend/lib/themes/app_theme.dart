import 'package:flutter/material.dart';

import '../presentation/ui/theme/fui_typography.dart';

class AppTheme {
  static final _fuiTypo = FUITypographyThemeLight();

  static final ThemeData lightTheme = ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(
      seedColor: const Color(0xFF1F6FEB),
      brightness: Brightness.light,
    ),
    scaffoldBackgroundColor: const Color(0xFFF5F7FB),
    visualDensity: VisualDensity.adaptivePlatformDensity,
    dividerColor: const Color(0xFFE4E9F2),
    cardTheme: CardThemeData(
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: Color(0xFFE4E9F2)),
      ),
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: Color(0xFFFFFFFF),
      foregroundColor: Color(0xFF1F2937),
      elevation: 0,
      scrolledUnderElevation: 0,
    ),
    textTheme: TextTheme(
      displayLarge: _fuiTypo.h1,
      displayMedium: _fuiTypo.h2,
      displaySmall: _fuiTypo.h3,
      headlineLarge: _fuiTypo.h4,
      headlineMedium: _fuiTypo.h5,
      bodyLarge: _fuiTypo.regular,
      bodyMedium: _fuiTypo.smallText,
      titleSmall: _fuiTypo.fieldLabel,
    ),
    dividerTheme: const DividerThemeData(
      color: Color(0xFFE4E9F2),
      thickness: 1,
      space: 1,
    ),
  );
}
