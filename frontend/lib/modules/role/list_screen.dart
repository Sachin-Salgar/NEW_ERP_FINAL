import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'package:provider/provider.dart';

import '../../core/network/api_client.dart';
import '../../core/auth/auth_service.dart';
import 'role_service.dart';
import 'edit_screen.dart';
import '../permission/role_permission_screen.dart';

class RoleListScreen extends StatelessWidget {
  static const routeName = '/roles';

  const RoleListScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final auth = GetIt.instance.get<AuthService>();

    // Gate UI using AuthZService; show forbidden if user lacks permission
    return ChangeNotifierProvider(
      create: (_) => RoleService(apiClient: GetIt.instance.get<ApiClient>()),
      child: Consumer<RoleService>(builder: (context, svc, _) {
        final hasPermission = auth.hasPermission('role.read');

        // If user lacks permission, show an unauthorized widget
        if (!hasPermission) {
          return Scaffold(
            appBar: AppBar(title: const Text('Roles')),
            body: const Center(child: Text('You do not have permission to view roles.')),
          );
        }

        // If roles not yet loaded, trigger fetch once
        if (!svc.isLoading && !svc.fetchedOnce && svc.error == null) {
          // kick off fetch
          WidgetsBinding.instance.addPostFrameCallback((_) {
            svc.fetchRoles();
          });
        }

        return Scaffold(
          appBar: AppBar(title: const Text('Roles')),
          body: Builder(builder: (context) {
            if (svc.isLoading) {
              return const Center(child: CircularProgressIndicator());
            }

            if (svc.error != null) {
              return Center(child: Text('Error: ${svc.error}'));
            }

            if (svc.roles.isEmpty) {
              return const Center(child: Text('No roles found.'));
            }

            return ListView.separated(
              itemCount: svc.roles.length,
              separatorBuilder: (_, __) => const Divider(height: 1),
              itemBuilder: (context, index) {
                final r = svc.roles[index];
                final name = r['name']?.toString() ?? r['code']?.toString() ?? 'Unnamed';
                final desc = r['description']?.toString() ?? '';
                final isSystem = r['isSystem'] == true;
                return ListTile(
                  title: Text(name),
                  subtitle: desc.isNotEmpty ? Text(desc) : null,
                  trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                    if (auth.hasPermission('role.manage')) ...[
                      IconButton(
                        icon: const Icon(Icons.edit),
                        onPressed: () {
                          Navigator.of(context).push(MaterialPageRoute(builder: (_) => RoleEditScreen(roleId: r['id']?.toString() ?? '')));
                        },
                      ),
                      IconButton(
                        icon: const Icon(Icons.admin_panel_settings),
                        tooltip: 'Manage permissions',
                        onPressed: () {
                          Navigator.of(context).push(MaterialPageRoute(builder: (_) => RolePermissionScreen(roleId: r['id']?.toString() ?? '')));
                        },
                      ),
                    ],
                    if (isSystem) const Icon(Icons.shield),
                  ]),
                );
              },
            );
          }),
        );
      }),
    );
  }
}
