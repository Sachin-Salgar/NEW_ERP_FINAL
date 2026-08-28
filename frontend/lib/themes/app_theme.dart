import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  static final TextTheme _poppins = GoogleFonts.poppinsTextTheme();

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
    textTheme: _poppins.copyWith(
      displayLarge: _poppins.displayLarge?.copyWith(fontWeight: FontWeight.w600),
      displayMedium: _poppins.displayMedium?.copyWith(fontWeight: FontWeight.w600),
      displaySmall: _poppins.displaySmall?.copyWith(fontWeight: FontWeight.w600),
      headlineLarge: _poppins.headlineLarge?.copyWith(fontWeight: FontWeight.w600),
      headlineMedium: _poppins.headlineMedium?.copyWith(fontWeight: FontWeight.w600),
      titleLarge: _poppins.titleLarge?.copyWith(fontWeight: FontWeight.w600),
      titleMedium: _poppins.titleMedium?.copyWith(fontWeight: FontWeight.w600),
      titleSmall: _poppins.titleSmall?.copyWith(fontWeight: FontWeight.w500),
    ),
    dividerTheme: const DividerThemeData(
      color: Color(0xFFE4E9F2),
      thickness: 1,
      space: 1,
    ),
  );
}
