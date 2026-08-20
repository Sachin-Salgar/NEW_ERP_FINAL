import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'package:provider/provider.dart';
import '../core/auth/auth_service.dart';
import '../routing/router.dart';
import '../themes/app_theme.dart';

final GetIt di = GetIt.instance;

class App extends StatefulWidget {
  const App({Key? key}) : super(key: key);

  static Future<void> init() async {
    // Initialize dependency injection, services, and persistent storage
    di.registerLazySingleton<AuthService>(() => AuthService());
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
