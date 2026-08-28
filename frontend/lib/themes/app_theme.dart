import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Global Material 3 theme tokens aligned to the visual language of the
/// abuanwar072 Responsive Admin Panel template, while remaining adaptive to
/// ERP light/dark mode and keeping all application content theme-driven.
class AppTheme {
  static final TextTheme _poppins = GoogleFonts.poppinsTextTheme();

  static const Color primary = Color(0xFF2697FF);
  static const Color templateSecondary = Color(0xFF2A2D3E);
  static const Color lightBackground = Color(0xFFF6F8FB);
  static const Color darkBackground = Color(0xFF212332);

  static final ThemeData lightTheme = _buildTheme(Brightness.light);
  static final ThemeData darkTheme = _buildTheme(Brightness.dark);

  static ThemeData _buildTheme(Brightness brightness) {
    final dark = brightness == Brightness.dark;
    final colorScheme = ColorScheme.fromSeed(
      seedColor: primary,
      brightness: brightness,
      surface: dark ? templateSecondary : Colors.white,
    ).copyWith(
      primary: primary,
      onPrimary: Colors.white,
      surface: dark ? templateSecondary : Colors.white,
      onSurface: dark ? const Color(0xFFF4F6FA) : const Color(0xFF252A34),
      surfaceContainerHighest: dark ? const Color(0xFF34384A) : const Color(0xFFF0F3F8),
      onSurfaceVariant: dark ? const Color(0xFFC7CBD5) : const Color(0xFF626A78),
      outline: dark ? const Color(0xFF50566A) : const Color(0xFFD7DCE5),
      outlineVariant: dark ? const Color(0xFF3A3F50) : const Color(0xFFE5E9F0),
    );

    final textTheme = _poppins.apply(
      bodyColor: colorScheme.onSurface,
      displayColor: colorScheme.onSurface,
    ).copyWith(
      displayLarge: _poppins.displayLarge?.copyWith(fontWeight: FontWeight.w600, color: colorScheme.onSurface),
      displayMedium: _poppins.displayMedium?.copyWith(fontWeight: FontWeight.w600, color: colorScheme.onSurface),
      displaySmall: _poppins.displaySmall?.copyWith(fontWeight: FontWeight.w600, color: colorScheme.onSurface),
      headlineLarge: _poppins.headlineLarge?.copyWith(fontWeight: FontWeight.w600, color: colorScheme.onSurface),
      headlineMedium: _poppins.headlineMedium?.copyWith(fontWeight: FontWeight.w600, color: colorScheme.onSurface),
      headlineSmall: _poppins.headlineSmall?.copyWith(fontWeight: FontWeight.w600, color: colorScheme.onSurface),
      titleLarge: _poppins.titleLarge?.copyWith(fontWeight: FontWeight.w600, color: colorScheme.onSurface),
      titleMedium: _poppins.titleMedium?.copyWith(fontWeight: FontWeight.w600, color: colorScheme.onSurface),
      titleSmall: _poppins.titleSmall?.copyWith(fontWeight: FontWeight.w500, color: colorScheme.onSurface),
      bodyLarge: _poppins.bodyLarge?.copyWith(color: colorScheme.onSurface),
      bodyMedium: _poppins.bodyMedium?.copyWith(color: colorScheme.onSurface),
      bodySmall: _poppins.bodySmall?.copyWith(color: colorScheme.onSurfaceVariant),
      labelLarge: _poppins.labelLarge?.copyWith(color: colorScheme.onSurface),
      labelMedium: _poppins.labelMedium?.copyWith(color: colorScheme.onSurfaceVariant),
      labelSmall: _poppins.labelSmall?.copyWith(color: colorScheme.onSurfaceVariant),
    );

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: dark ? darkBackground : lightBackground,
      visualDensity: VisualDensity.adaptivePlatformDensity,
      fontFamily: GoogleFonts.poppins().fontFamily,
      textTheme: textTheme,
      dividerColor: dark ? const Color(0xFF41465A) : const Color(0xFFE5E9F0),
      cardTheme: CardThemeData(
        color: dark ? templateSecondary : Colors.white,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
          side: BorderSide(color: dark ? const Color(0xFF41465A) : const Color(0xFFE5E9F0)),
        ),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: dark ? templateSecondary : Colors.white,
        foregroundColor: colorScheme.onSurface,
        elevation: 0,
        scrolledUnderElevation: 0,
        surfaceTintColor: Colors.transparent,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: dark ? const Color(0xFF2A2D3E) : Colors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
        border: OutlineInputBorder(
          borderRadius: const BorderRadius.all(Radius.circular(10)),
          borderSide: BorderSide(color: dark ? const Color(0xFF50566A) : const Color(0xFFD7DCE5)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: const BorderRadius.all(Radius.circular(10)),
          borderSide: BorderSide(color: dark ? const Color(0xFF50566A) : const Color(0xFFD7DCE5)),
        ),
        focusedBorder: const OutlineInputBorder(
          borderRadius: BorderRadius.all(Radius.circular(10)),
          borderSide: BorderSide(color: primary, width: 1.5),
        ),
        hintStyle: TextStyle(color: colorScheme.onSurfaceVariant),
      ),
      iconTheme: IconThemeData(color: colorScheme.onSurfaceVariant),
      dividerTheme: DividerThemeData(color: colorScheme.outlineVariant, thickness: 1, space: 1),
      chipTheme: ChipThemeData(
        backgroundColor: dark ? const Color(0xFF34384A) : const Color(0xFFF0F3F8),
        side: BorderSide(color: colorScheme.outlineVariant),
        labelStyle: textTheme.labelLarge,
      ),
    );
  }
}
