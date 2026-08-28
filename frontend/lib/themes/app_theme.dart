import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  static final TextTheme _poppins = GoogleFonts.poppinsTextTheme();

  static final ThemeData lightTheme = _buildTheme(Brightness.light);
  static final ThemeData darkTheme = _buildTheme(Brightness.dark);

  static ThemeData _buildTheme(Brightness brightness) {
    final dark = brightness == Brightness.dark;
    final colorScheme = ColorScheme.fromSeed(
      seedColor: const Color(0xFF2877E8),
      brightness: brightness,
      surface: dark ? const Color(0xFF151A21) : const Color(0xFFF6F8FB),
    );

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: dark ? const Color(0xFF101419) : const Color(0xFFF6F8FB),
      visualDensity: VisualDensity.adaptivePlatformDensity,
      dividerColor: dark ? const Color(0xFF2B333E) : const Color(0xFFE5E9F0),
      cardTheme: CardThemeData(
        color: dark ? const Color(0xFF181E26) : const Color(0xFFFFFFFF),
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
          side: BorderSide(color: dark ? const Color(0xFF2B333E) : const Color(0xFFE5E9F0)),
        ),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: dark ? const Color(0xFF151A21) : const Color(0xFFFFFFFF),
        foregroundColor: dark ? const Color(0xFFF2F4F7) : const Color(0xFF1D2433),
        elevation: 0,
        scrolledUnderElevation: 0,
        surfaceTintColor: Colors.transparent,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: dark ? const Color(0xFF1D242D) : const Color(0xFFFFFFFF),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: const BorderRadius.all(Radius.circular(8)),
          borderSide: BorderSide(color: dark ? const Color(0xFF35404D) : const Color(0xFFE5E9F0)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: const BorderRadius.all(Radius.circular(8)),
          borderSide: BorderSide(color: dark ? const Color(0xFF35404D) : const Color(0xFFE5E9F0)),
        ),
        focusedBorder: const OutlineInputBorder(
          borderRadius: BorderRadius.all(Radius.circular(8)),
          borderSide: BorderSide(color: Color(0xFF2877E8), width: 1.5),
        ),
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
      dividerTheme: DividerThemeData(
        color: dark ? const Color(0xFF2B333E) : const Color(0xFFE5E9F0),
        thickness: 1,
        space: 1,
      ),
    );
  }
}
