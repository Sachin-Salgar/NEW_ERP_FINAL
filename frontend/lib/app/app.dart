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
    // Initialize dependency injection, services, and persistent storage
    di.registerLazySingleton<AuthService>(() => AuthService());
    // Register ApiClient with default base URL; override via --dart-define=API_BASE_URL
    final baseUrl = const String.fromEnvironment('API_BASE_URL', defaultValue: 'http://localhost:3001');
    di.registerLazySingleton(() => ApiClient(baseUrl: baseUrl));
    // Register OrganizationService using the ApiClient
    di.registerLazySingleton(() => OrganizationService(apiClient: di.get<ApiClient>()));
    // Register BranchService
    di.registerLazySingleton(() => BranchService(apiClient: di.get<ApiClient>()));
    // Register UserService
    di.registerLazySingleton(() => UserService(apiClient: di.get<ApiClient>()));

    await di.get<AuthService>().init();
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
          return MaterialApp(
            title: 'NEW ERP',
            theme: AppTheme.lightTheme,
            onGenerateRoute: AppRouter.generateRoute,
            initialRoute: auth.isAuthenticated ? '/dashboard' : '/login',
          );
        },
      ),
    );
  }
}
