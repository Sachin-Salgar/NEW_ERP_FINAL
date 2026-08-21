import 'package:flutter/material.dart';

import '../../theme/fui_typography.dart';

abstract class FUIButtonTheme {
  /// Enable/Disable
  static const Duration opacityAnimationDuration = Duration(milliseconds: 500);
  static const double opacityDisabled = 0.7;

  /// Size Factor
  static const double widthBufferSmall = 28;
  static const double widthBufferMedium = 30;
  static const double widthBufferLarge = 45;

  static const double heightBufferSmall = 15;
  static const double heightBufferMedium = 18;
  static const double heightBufferLarge = 25;

  static const double fontSizeSmall = 11;
  static const double fontSizeMedium = 13;
  static const double fontSizeLarge = 15;

  static const double shapeRoundedBorderRadius = 50;
  static const double shapeSquareBorderRadius = 5;

  /// Colors
  Color get buttonOverlayColor;

  /// Button Styles
  ButtonStyle get iconButtonStyle;

  ButtonStyle get menuButtonStyle;

  /// Text Styles
  TextStyle get textIconButtonWhite;

  TextStyle get textIconButtonBlack;

  TextStyle get linkedButtonTextStyle;

  TextStyle get linkedButtonHoverTextStyle;
}

class FUIButtonThemeLight extends FUIButtonTheme {
  /// Colors are intentionally minimal here; the App should provide a color palette
  @override
  Color get buttonOverlayColor => Colors.black12;

  /// Button Styles
  @override
  ButtonStyle get iconButtonStyle => IconButton.styleFrom(
    focusColor: Colors.transparent,
    hoverColor: Colors.transparent,
    highlightColor: Colors.transparent,
    splashFactory: NoSplash.splashFactory,
  );

  @override
  ButtonStyle get menuButtonStyle => TextButton.styleFrom(
    backgroundColor: Colors.transparent,
    splashFactory: NoSplash.splashFactory,
  );

  /// Text Styles
  @override
  TextStyle get textIconButtonWhite => TextStyle(
    color: Colors.white,
    fontFamily: FUITypographyTheme.fontFamilyPrimary,
    fontWeight: FontWeight.w400,
    decoration: TextDecoration.none,
  );

  @override
  TextStyle get textIconButtonBlack => TextStyle(
    color: Colors.black87,
    fontFamily: FUITypographyTheme.fontFamilyPrimary,
    fontWeight: FontWeight.w400,
    decoration: TextDecoration.none,
  );

  @override
  TextStyle get linkedButtonTextStyle => TextStyle(
    color: Colors.blue,
    fontFamily: FUITypographyTheme.fontFamilyPrimary,
    fontWeight: FontWeight.w600,
    decoration: TextDecoration.none,
  );

  @override
  TextStyle get linkedButtonHoverTextStyle => TextStyle(
    color: Colors.blueAccent,
    fontFamily: FUITypographyTheme.fontFamilyPrimary,
    fontWeight: FontWeight.w700,
    decoration: TextDecoration.none,
  );
}
