import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'package:provider/provider.dart';

import '../../core/network/api_client.dart';
import '../../core/auth/auth_service.dart';
import 'permission_service.dart';
import 'permission_detail_screen.dart';

class PermissionListScreen extends StatelessWidget {
  const PermissionListScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final auth = GetIt.instance.get<AuthService>();

    return ChangeNotifierProvider(
      create: (_) => PermissionService(apiClient: GetIt.instance.get<ApiClient>()),
      child: Consumer<PermissionService>(builder: (context, svc, _) {
        final hasPermission = auth.hasPermission('permission.read');

        if (!hasPermission) {
          return Scaffold(
            appBar: AppBar(title: const Text('Permissions')),
            body: const Center(child: Text('You do not have permission to view permissions.')),
          );
        }

        if (!svc.isLoading && !svc.fetchedOnce && svc.error == null) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            svc.fetchPermissions();
          });
        }

        return Scaffold(
          appBar: AppBar(title: const Text('Permissions')),
          body: Builder(builder: (context) {
            if (svc.isLoading) {
              return const Center(child: CircularProgressIndicator());
            }

            if (svc.error != null) {
              return Center(child: Text('Error: ${svc.error}'));
            }

            if (svc.permissions.isEmpty) {
              return const Center(child: Text('No permissions found.'));
            }

            return ListView.separated(
              itemCount: svc.permissions.length,
              separatorBuilder: (_, __) => const Divider(height: 1),
              itemBuilder: (context, index) {
                final key = svc.permissions[index];
                return ListTile(
                  title: Text(key),
                  onTap: () {
                    Navigator.of(context).push(MaterialPageRoute(builder: (_) => PermissionDetailScreen(permissionKey: key)));
                  },
                );
              },
            );
          }),
        );
      }),
    );
  }
}
