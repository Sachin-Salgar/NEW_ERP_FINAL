import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import '../core/auth/auth_service.dart';
import '../modules/dashboard/dashboard_screen.dart';

class AppRouter {
  static Route<dynamic>? generateRoute(RouteSettings settings) {
    switch (settings.name) {
      case '/login':
        return MaterialPageRoute(builder: (_) => LoginRoutePlaceholder());
      case '/dashboard':
        return MaterialPageRoute(builder: (_) => _authGuard((_) => const DashboardScreen()));
      default:
        return MaterialPageRoute(builder: (_) => Scaffold(body: Center(child: Text('Unknown route: ${settings.name}'))));
    }
  }

  static Widget _authGuard(WidgetBuilder builder) {
    final auth = GetIt.instance.get<AuthService>();
    if (!auth.isAuthenticated) {
      return LoginRoutePlaceholder();
    }
    return builder(null);
  }
}

class LoginRoutePlaceholder extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(child: Text('Login screen not implemented — use /login')), 
    );
  }
}
