import 'package:new_erp_final_frontend/core/network/api_client.dart';
import 'package:new_erp_final_frontend/core/auth/auth_service.dart';
import 'package:new_erp_final_frontend/core/auth/authz_service.dart';
import 'package:new_erp_final_frontend/routing/router.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:get_it/get_it.dart';

class TestApp extends StatelessWidget {
  final Widget child;
  const TestApp({Key? key, required this.child}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      onGenerateRoute: AppRouter.generateRoute,
      home: Scaffold(body: child),
    );
  }
}

void registerTestServices({required ApiClient apiClient}) {
  FlutterSecureStorage.setMockInitialValues({});
  if (!GetIt.instance.isRegistered<ApiClient>()) GetIt.instance.registerSingleton<ApiClient>(apiClient);
  // Ensure a single AuthZService instance is shared with AuthService
  final authz = AuthZService();
  if (!GetIt.instance.isRegistered<AuthZService>()) GetIt.instance.registerSingleton<AuthZService>(authz);
  if (!GetIt.instance.isRegistered<AuthService>()) {
    GetIt.instance.registerSingleton<AuthService>(
      AuthService(authzService: authz, apiClientFactory: (_) => apiClient),
    );
  }
}
