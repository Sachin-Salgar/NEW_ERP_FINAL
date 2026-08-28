import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class ThemeController extends ChangeNotifier {
  static const _storageKey = 'erp_theme_mode';
  static const _storage = FlutterSecureStorage();

  ThemeMode _themeMode = ThemeMode.light;
  bool _initialized = false;

  ThemeMode get themeMode => _themeMode;
  bool get isDark => _themeMode == ThemeMode.dark;
  bool get isInitialized => _initialized;

  Future<void> init() async {
    final stored = await _storage.read(key: _storageKey);
    _themeMode = stored == 'dark' ? ThemeMode.dark : ThemeMode.light;
    _initialized = true;
    notifyListeners();
  }

  Future<void> setDark(bool dark) async {
    final next = dark ? ThemeMode.dark : ThemeMode.light;
    if (_themeMode == next) return;
    _themeMode = next;
    notifyListeners();
    await _storage.write(key: _storageKey, value: dark ? 'dark' : 'light');
  }

  Future<void> toggle() => setDark(!isDark);
}
