import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'package:provider/provider.dart';

import '../core/auth/auth_service.dart';
import '../modules/branch/branch_service.dart';
import '../modules/customer/customer_service.dart';
import '../modules/item_master/item_master_service.dart';
import '../modules/sales/sales_service.dart';
import '../modules/organization/organization_service.dart';
import '../modules/role/role_service.dart';
import '../modules/user/user_service.dart';
import '../routing/app_router_delegate.dart';
import '../themes/app_theme.dart';
import '../themes/theme_controller.dart';
import '../core/network/api_client.dart';

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
    di.registerLazySingleton(() => RoleService(apiClient: di.get<ApiClient>()));
    di.registerLazySingleton(
      () => CustomerService(
        apiClient: di.get<ApiClient>(),
        auth: di.get<AuthService>(),
      ),
    );
    di.registerLazySingleton(
      () => ItemMasterService(
        apiClient: di.get<ApiClient>(),
        auth: di.get<AuthService>(),
      ),
    );
    di.registerLazySingleton(
      () => SalesService(
        apiClient: di.get<ApiClient>(),
        auth: di.get<AuthService>(),
      ),
    );

    final auth = di.get<AuthService>();
    final theme = di.get<ThemeController>();
    await Future.wait([theme.init(), auth.init()]);
    await auth.bootstrap(baseUrl);
    if (auth.isAuthenticated) {
      await auth.restoreSession(baseUrl);
    }
  }

  @override
  State<App> createState() => _AppState();
}

class _AppState extends State<App> {
  late final AppRouterDelegate _routerDelegate;
  final AppRouteInformationParser _routeInformationParser =
      AppRouteInformationParser();

  @override
  void initState() {
    super.initState();
    _routerDelegate = AppRouterDelegate(auth: di.get<AuthService>());
  }

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider<AuthService>.value(value: di.get<AuthService>()),
        ChangeNotifierProvider<ThemeController>.value(
          value: di.get<ThemeController>(),
        ),
      ],
      child: Consumer2<AuthService, ThemeController>(
        builder: (context, auth, themeController, _) {
          return MaterialApp.router(
            title: 'NEW ERP',
            theme: AppTheme.lightTheme,
            darkTheme: AppTheme.darkTheme,
            themeMode: themeController.themeMode,
            routerDelegate: _routerDelegate,
            routeInformationParser: _routeInformationParser,
          );
        },
      ),
    );
  }

  @override
  void dispose() {
    _routerDelegate.dispose();
    super.dispose();
  }
}
