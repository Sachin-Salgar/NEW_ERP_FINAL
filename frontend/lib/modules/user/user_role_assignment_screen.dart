import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import '../../core/auth/auth_service.dart';
import '../../core/network/api_client.dart';
import '../role/role_service.dart';
import 'user_service.dart';

class UserRoleAssignmentScreen extends StatefulWidget {
  final String userId;

  const UserRoleAssignmentScreen({Key? key, required this.userId})
    : super(key: key);

  @override
  State<UserRoleAssignmentScreen> createState() =>
      _UserRoleAssignmentScreenState();
}

class _UserRoleAssignmentScreenState extends State<UserRoleAssignmentScreen> {
  final auth = GetIt.instance.get<AuthService>();
  final userService = GetIt.instance.get<UserService>();
  final roleService = GetIt.instance.get<RoleService>();
  final apiClient = GetIt.instance.get<ApiClient>();

  Map<String, dynamic>? user;
  final Map<String, Set<String>> _rolePermissions = {};
  Set<String> assignedRoleIds = {};
  bool loading = true;
  bool submitting = false;
  String? error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = null;
      assignedRoleIds = {};
      _rolePermissions.clear();
    });

    try {
      final loadedUser = await userService.getUser(widget.userId);
      await roleService.fetchRoles();

      final effectivePermissionsResponse = await apiClient.get(
        '/api/v1/rbac/users/${widget.userId}/effective-permissions',
      );

      final effectivePermissionSet = <String>{};
      if (effectivePermissionsResponse.statusCode == 200) {
        final body = jsonDecode(
          effectivePermissionsResponse.body,
        ) as Map<String, dynamic>;
        final permissions = (body['permissions'] as List<dynamic>? ?? const []);
        effectivePermissionSet.addAll(
          permissions.map((value) => value.toString()),
        );
      }

      final assigned = <String>{};
      for (final role in roleService.roles) {
        final roleId = role['id']?.toString() ?? '';
        if (roleId.isEmpty) continue;

        final permissions = await roleService.getRolePermissions(roleId);
        final permissionKeys = permissions
            .map((entry) => entry['permissionKey']?.toString() ?? '')
            .where((key) => key.isNotEmpty)
            .toSet();

        _rolePermissions[roleId] = permissionKeys;

        if (permissionKeys.isNotEmpty &&
            permissionKeys.every(effectivePermissionSet.contains)) {
          assigned.add(roleId);
        }
      }

      if (!mounted) return;
      setState(() {
        user = loadedUser;
        assignedRoleIds = assigned;
        loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        error = e.toString();
        loading = false;
      });
    }
  }

  Future<void> _toggleRole(Map<String, dynamic> role, bool isAssigned) async {
    final roleId = role['id']?.toString() ?? '';
    if (roleId.isEmpty) return;

    setState(() {
      submitting = true;
      error = null;
    });

    final bool ok;
    if (isAssigned) {
      ok = await userService.revokeRoleFromUser(widget.userId, roleId);
    } else {
      ok = await userService.assignRoleToUser(widget.userId, roleId);
    }

    if (!mounted) return;

    setState(() {
      submitting = false;
    });

    if (!ok) {
      setState(
        () => error = 'Failed to ${isAssigned ? 'remove' : 'assign'} role.',
      );
      return;
    }

    await _load();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(isAssigned ? 'Role removed' : 'Role assigned')),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (!auth.hasPermission('user.manage')) {
      return Scaffold(
        appBar: AppBar(title: const Text('User Roles')),
        body: const Center(
          child: Text('You do not have permission to manage user roles.'),
        ),
      );
    }

    final availableRoles = roleService.roles;
    final assignedRoleNames = availableRoles
        .where((role) => assignedRoleIds.contains(role['id']?.toString() ?? ''))
        .map(
          (role) =>
              role['name']?.toString() ?? role['code']?.toString() ?? 'Unnamed',
        )
        .toList();

    return Scaffold(
      appBar: AppBar(title: const Text('User Roles')),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (user != null) ...[
                    Text(
                      'User: ${user!['username'] ?? user!['email'] ?? 'Unknown user'}',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 8),
                  ],
                  if (error != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Text(
                        error!,
                        style: const TextStyle(color: Colors.red),
                      ),
                    ),
                  Text(
                    'Current roles',
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                  const SizedBox(height: 8),
                  if (assignedRoleNames.isEmpty)
                    const Text('No roles assigned.')
                  else
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: assignedRoleNames
                          .map((name) => Chip(label: Text(name)))
                          .toList(),
                    ),
                  const SizedBox(height: 24),
                  Text(
                    'Available roles',
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                  const SizedBox(height: 8),
                  if (availableRoles.isEmpty)
                    const Text('No roles available.')
                  else
                    Expanded(
                      child: ListView.separated(
                        itemCount: availableRoles.length,
                        separatorBuilder: (_, __) => const Divider(height: 1),
                        itemBuilder: (context, index) {
                          final role = availableRoles[index];
                          final roleId = role['id']?.toString() ?? '';
                          final name =
                              role['name']?.toString() ??
                              role['code']?.toString() ??
                              'Unnamed';
                          final description =
                              role['description']?.toString() ?? '';
                          final isAssigned = assignedRoleIds.contains(roleId);

                          return ListTile(
                            title: Text(name),
                            subtitle: description.isNotEmpty
                                ? Text(description)
                                : null,
                            trailing: submitting
                                ? const SizedBox(
                                    width: 18,
                                    height: 18,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                    ),
                                  )
                                : ElevatedButton(
                                    onPressed: () =>
                                        _toggleRole(role, isAssigned),
                                    child: Text(
                                      isAssigned ? 'Remove' : 'Assign',
                                    ),
                                  ),
                          );
                        },
                      ),
                    ),
                ],
              ),
            ),
    );
  }
}
