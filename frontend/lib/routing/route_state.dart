import 'package:flutter/material.dart';

/// Tracks the active top-level route so the persistent app shell can update
/// its title and selected navigation item without being recreated.
class AppRouteState {
  AppRouteState._();

  static final ValueNotifier<String?> currentRoute =
      ValueNotifier<String?>('/dashboard');
}

class AppRouteObserver extends NavigatorObserver {
  void _update(Route<dynamic>? route) {
    final name = route?.settings.name;
    if (name != null && name.isNotEmpty) {
      AppRouteState.currentRoute.value = name;
    }
  }

  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) {
    _update(route);
  }

  @override
  void didPop(Route<dynamic> route, Route<dynamic>? previousRoute) {
    _update(previousRoute);
  }

  @override
  void didReplace({Route<dynamic>? newRoute, Route<dynamic>? oldRoute}) {
    _update(newRoute);
  }
}
