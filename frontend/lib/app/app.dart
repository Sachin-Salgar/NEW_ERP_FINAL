import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'package:provider/provider.dart';

import '../core/auth/auth_service.dart';
import '../modules/organization/organization_service.dart';
import '../modules/branch/branch_service.dart';
import '../modules/user/user_service.dart';
import '../routing/router.dart';
import '../routing/route_state.dart';
import '../themes/app_theme.dart';
import '../themes/theme_controller.dart';
import '../core/network/api_client.dart';
import '../widgets/app_shell.dart';

final GetIt di = GetIt.instance;

class App extends StatefulWidget {
  const App({Key? key}) : super(key: key);

  static Future<void> init() async {
    di.registerLazySingleton<AuthService>(() => AuthService());
    di.registerLazySingleton<ThemeController>(() => ThemeController());
    final baseUrl = const String.fromEnvironment(
      'API_BASE_URL',
      defaultValue: 'http://localhost:3000',
    );
    di.registerLazySingleton(() => ApiClient(baseUrl: baseUrl));
    di.registerLazySingleton(
      () => OrganizationService(apiClient: di.get<ApiClient>()),
    );
    di.registerLazySingleton(
      () => BranchService(apiClient: di.get<ApiClient>()),
    );
    di.registerLazySingleton(() => UserService(apiClient: di.get<ApiClient>()));

    final auth = di.get<AuthService>();
    final theme = di.get<ThemeController>();
    await Future.wait([
      theme.init(),
      auth.init(),
    ]);
    await auth.bootstrap(baseUrl);
    if (auth.isAuthenticated) {
      await auth.restoreSession(baseUrl);
    }
  }

  @override
  State<App> createState() => _AppState();
}

class _AppState extends State<App> {
  final AppRouteObserver _routeObserver = AppRouteObserver();
  final GlobalKey<NavigatorState> _navigatorKey = GlobalKey<NavigatorState>();

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider<AuthService>.value(value: di.get<AuthService>()),
        ChangeNotifierProvider<ThemeController>.value(value: di.get<ThemeController>()),
      ],
      child: Consumer2<AuthService, ThemeController>(
        builder: (context, auth, themeController, _) {
          final route = auth.nextPostAuthRoute;

          return MaterialApp(
            title: 'NEW ERP',
            theme: AppTheme.lightTheme,
            darkTheme: AppTheme.darkTheme,
            themeMode: themeController.themeMode,
            navigatorKey: _navigatorKey,
            onGenerateRoute: AppRouter.generateRoute,
            navigatorObservers: [_routeObserver],
            initialRoute: route,
            builder: (context, child) {
              if (!auth.isAuthenticated) {
                return child ?? const SizedBox.shrink();
              }
              return AppShell(
                navigatorKey: _navigatorKey,
                child: child ?? const SizedBox.shrink(),
              );
            },
          );
        },
      ),
    );
  }
}
