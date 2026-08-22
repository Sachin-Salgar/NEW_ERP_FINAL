import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_service.dart';
import '../../core/network/api_client.dart';
import '../role/role_service.dart';
import 'permission_service.dart';

class RolePermissionScreen extends StatefulWidget {
  final String roleId;
  const RolePermissionScreen({Key? key, required this.roleId}) : super(key: key);

  @override
  State<RolePermissionScreen> createState() => _RolePermissionScreenState();
}

class _RolePermissionScreenState extends State<RolePermissionScreen> {
  late Future<List<Map<String, dynamic>>> _loadFuture;
  bool _initialized = false;

  @override
  void initState() {
    super.initState();
    // placeholder; real load triggered after providers are available
    _loadFuture = Future.value([]);
  }

  void _reload(RoleService roleSvc) {
    setState(() {
      _loadFuture = roleSvc.getRolePermissions(widget.roleId);
      _initialized = true;
    });
  }

  @override
  Widget build(BuildContext context) {
    final auth = GetIt.instance.get<AuthService>();

    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => PermissionService(apiClient: GetIt.instance.get<ApiClient>())),
        ChangeNotifierProvider(create: (_) => RoleService(apiClient: GetIt.instance.get<ApiClient>())),
      ],
      child: Consumer2<PermissionService, RoleService>(builder: (context, permSvc, roleSvc, _) {
        final canManage = auth.hasPermission('role.manage');

        // kick off initial loads
        if (!permSvc.isLoading && !permSvc.fetchedOnce && permSvc.error == null) {
          WidgetsBinding.instance.addPostFrameCallback((_) => permSvc.fetchPermissions());
        }

        if (!_initialized) {
          // initialize load
          WidgetsBinding.instance.addPostFrameCallback((_) => _reload(roleSvc));
        }

        return Scaffold(
          appBar: AppBar(title: const Text('Manage Role Permissions')),
          body: Builder(builder: (context) {
            if (permSvc.isLoading || roleSvc.isLoading) {
              return const Center(child: CircularProgressIndicator());
            }

            if (permSvc.error != null) {
              return Center(child: Text('Error loading permissions: ${permSvc.error}'));
            }

            if (roleSvc.error != null) {
              return Center(child: Text('Error loading role permissions: ${roleSvc.error}'));
            }

            final allPermissions = permSvc.permissions; // List<String>

            return FutureBuilder<List<Map<String, dynamic>>>(
              future: _loadFuture,
              builder: (context, snap) {
                if (snap.connectionState != ConnectionState.done) {
                  return const Center(child: CircularProgressIndicator());
                }

                if (snap.hasError) {
                  return Center(child: Text('Error: ${snap.error}'));
                }

                final rolePerms = snap.data ?? [];
                final assignedSet = rolePerms.map((e) => e['permissionKey']?.toString() ?? '').where((e) => e.isNotEmpty).toSet();

                if (allPermissions.isEmpty) {
                  if (!permSvc.fetchedOnce) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  return const Center(child: Text('No permissions available.'));
                }

                return ListView.separated(
                  itemCount: allPermissions.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (context, index) {
                    final key = allPermissions[index];
                    final isAssigned = assignedSet.contains(key);
                    return ListTile(
                      title: Text(key),
                      trailing: canManage
                          ? isAssigned
                              ? IconButton(
                                                            tooltip: 'Remove permission',
                                                            icon: const Icon(Icons.remove_circle_outline),
                                                            onPressed: () async {
                                    final snack = ScaffoldMessenger.of(context);
                                    snack.showSnackBar(const SnackBar(content: Text('Removing permission...')));
                                    final removed = await roleSvc.removePermissionsFromRole(widget.roleId, [key]);
                                    snack.hideCurrentSnackBar();
                                    if (removed > 0) {
                                      _reload(roleSvc);
                                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Permission removed')));
                                    } else {
                                      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to remove permission: ${roleSvc.error ?? ''}')));
                                    }
                                  },
                                )
                              : IconButton(
                                                                tooltip: 'Assign permission',
                                                                icon: const Icon(Icons.add_circle_outline),
                                                                onPressed: () async {
                                    final snack = ScaffoldMessenger.of(context);
                                    snack.showSnackBar(const SnackBar(content: Text('Assigning permission...')));
                                    final assigned = await roleSvc.assignPermissionsToRole(widget.roleId, [key]);
                                    snack.hideCurrentSnackBar();
                                    if (assigned > 0) {
                                      _reload(roleSvc);
                                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Permission assigned')));
                                    } else {
                                      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to assign permission: ${roleSvc.error ?? ''}')));
                                    }
                                  },
                                )
                          : null,
                    );
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
