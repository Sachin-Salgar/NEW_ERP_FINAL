import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'package:provider/provider.dart';

import '../core/auth/auth_service.dart';
import '../core/network/api_client.dart';
import '../modules/organization/organization_service.dart';
import '../modules/branch/branch_service.dart';
import '../modules/user/user_service.dart';
import '../routing/router.dart';
import '../themes/app_theme.dart';

final GetIt di = GetIt.instance;

class App extends StatefulWidget {
  const App({Key? key}) : super(key: key);

  static Future<void> init() async {
    di.registerLazySingleton<AuthService>(() => AuthService());
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
    await auth.init();
    await auth.bootstrap(baseUrl);
    if (auth.isAuthenticated) {
      await auth.restoreSession(baseUrl);
    }
  }

  @override
  State<App> createState() => _AppState();
}

class _AppState extends State<App> {
  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider<AuthService>(
      create: (_) => di.get<AuthService>(),
      child: Consumer<AuthService>(
        builder: (context, auth, _) {
          final route = auth.nextPostAuthRoute;

          return MaterialApp(
            title: 'NEW ERP',
            theme: AppTheme.lightTheme,
            onGenerateRoute: AppRouter.generateRoute,
            initialRoute: route,
          );
        },
      ),
    );
  }
}
