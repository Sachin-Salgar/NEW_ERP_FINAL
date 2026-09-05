import 'package:flutter/material.dart';

import '../core/auth/auth_service.dart';

import 'dart:async';

import '../modules/auth/login_screen.dart';
import '../widgets/app_shell.dart';
import 'route_config.dart';
import 'route_state.dart';
import 'router.dart';

/// Bridges browser URL/history with the persistent authenticated ERP shell.
/// The shell owns presentation; the nested navigator owns screen content.
class AppRouterDelegate extends RouterDelegate<String>
    with ChangeNotifier, PopNavigatorRouterDelegateMixin<String> {
  final AuthService auth;

  @override
  final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

  final GlobalKey<NavigatorState> contentNavigatorKey =
      GlobalKey<NavigatorState>();

  late final NavigatorObserver _contentObserver;
  String _path = '/dashboard';
  bool _disposed = false;
  bool _syncingBrowserRoute = false;

  static String normalizePath(String? path) => AppRoutes.normalize(path ?? '/');

  AppRouterDelegate({required this.auth}) {
    _contentObserver = _ContentRouteObserver(_onContentRouteChanged);
    auth.addListener(_onAuthChanged);
    _path = normalizePath(_path);
    _syncRouteState(_path);
  }

  @override
  String get currentConfiguration => _path;

  @override
  Future<void> setNewRoutePath(String configuration) async {
    var target = normalizePath(configuration);
    if (!auth.isAuthenticated) {
      target = '/login';
    } else if (target == '/login') {
      target = '/dashboard';
    }

    _setPath(target, notify: false);
    final navigator = contentNavigatorKey.currentState;
    if (!auth.isAuthenticated || navigator == null || target == '/login')
      return;

    _syncingBrowserRoute = true;
    final completer = Completer<void>();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_disposed) {
        completer.complete();
        return;
      }
      final currentNavigator = contentNavigatorKey.currentState;
      if (currentNavigator != null && !currentNavigator.mounted) {
        completer.complete();
        return;
      }
      if (currentNavigator != null) {
        currentNavigator
            .pushNamedAndRemoveUntil(target, (_) => false)
            .whenComplete(() {
              completer.complete();
            });
      } else {
        completer.complete();
      }
      _syncingBrowserRoute = false;
    });
    await completer.future;
  }

  void navigate(String path) {
    final target = normalizePath(path);
    if (!auth.isAuthenticated || target == _path) return;
    contentNavigatorKey.currentState?.pushNamed(target);
  }

  void _onContentRouteChanged(String? routeName) {
    if (routeName == null || routeName.isEmpty) return;
    final target = AppRoutes.normalize(routeName);
    if (_syncingBrowserRoute || target == _path) return;
    _setPath(target);
  }

  void _onAuthChanged() {
    if (!auth.isAuthenticated) {
      _setPath('/login');
    } else if (_path == '/login' || _path.isEmpty) {
      _setPath('/dashboard');
    } else {
      notifyListeners();
    }
  }

  void _setPath(String path, {bool notify = true}) {
    final target = AppRoutes.normalize(path);
    if (_path == target) {
      _syncRouteState(target);
      if (notify && !_disposed) notifyListeners();
      return;
    }
    _path = target;
    _syncRouteState(target);
    if (notify && !_disposed) notifyListeners();
  }

  void _syncRouteState(String path) {
    AppRouteState.currentRoute.value = path;
  }

  @override
  Widget build(BuildContext context) {
    if (!auth.isAuthenticated) {
      return Navigator(
        key: navigatorKey,
        pages: const [
          MaterialPage(
            key: ValueKey('login-page'),
            name: '/login',
            child: LoginScreen(),
          ),
        ],
        onDidRemovePage: (_) {},
      );
    }

    final initialRoute = _path == '/login' ? '/dashboard' : _path;
    return Navigator(
      key: navigatorKey,
      pages: [
        MaterialPage(
          key: const ValueKey('authenticated-shell'),
          name: '/app-shell',
          child: AppShell(
            navigatorKey: contentNavigatorKey,
            rootNavigatorKey: navigatorKey,
            child: Navigator(
              key: contentNavigatorKey,
              initialRoute: initialRoute,
              onGenerateRoute: AppRouter.generateRoute,
              observers: [_contentObserver],
            ),
          ),
        ),
      ],
      onDidRemovePage: (_) {},
    );
  }

  @override
  void dispose() {
    _disposed = true;
    auth.removeListener(_onAuthChanged);
    super.dispose();
  }
}

class _ContentRouteObserver extends NavigatorObserver {
  final ValueChanged<String?> onChanged;

  _ContentRouteObserver(this.onChanged);

  void _update(Route<dynamic>? route) => onChanged(route?.settings.name);

  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) =>
      _update(route);

  @override
  void didPop(Route<dynamic> route, Route<dynamic>? previousRoute) =>
      _update(previousRoute);

  @override
  void didReplace({Route<dynamic>? newRoute, Route<dynamic>? oldRoute}) =>
      _update(newRoute);
}

class AppRouteInformationParser extends RouteInformationParser<String> {
  @override
  Future<String> parseRouteInformation(
    RouteInformation routeInformation,
  ) async {
    return AppRoutes.normalize(routeInformation.uri.path);
  }

  @override
  RouteInformation restoreRouteInformation(String configuration) {
    return RouteInformation(uri: Uri.parse(AppRoutes.normalize(configuration)));
  }
}
