import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import '../../../core/auth/auth_service.dart';
import '../../role/role_service.dart';
import '../user_service.dart';

class UserRolesSection extends StatefulWidget {
  final String userId;

  const UserRolesSection({super.key, required this.userId});

  @override
  State<UserRolesSection> createState() => _UserRolesSectionState();
}

class _UserRolesSectionState extends State<UserRolesSection> {
  final auth = GetIt.instance.get<AuthService>();
  final userService = GetIt.instance.get<UserService>();
  final roleService = GetIt.instance.get<RoleService>();
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
    if (!mounted) return;
    setState(() {
      loading = true;
      error = null;
      assignedRoleIds = {};
    });
    try {
      await roleService.fetchRoles();
      final assignedRoles = await userService.getAssignedRoles(widget.userId);
      if (!mounted) return;
      setState(() {
        assignedRoleIds = assignedRoles
            .map((role) => role['id']?.toString() ?? '')
            .where((id) => id.isNotEmpty)
            .toSet();
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
    final ok = isAssigned
        ? await userService.revokeRoleFromUser(widget.userId, roleId)
        : await userService.assignRoleToUser(widget.userId, roleId);
    if (!mounted) return;
    setState(() => submitting = false);
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
      return const Center(
        child: Text('You do not have permission to manage user roles.'),
      );
    }
    if (loading) return const Center(child: CircularProgressIndicator());
    final assignedRoles = roleService.roles
        .where((role) => assignedRoleIds.contains(role['id']?.toString() ?? ''))
        .toList();
    final availableRoles = roleService.roles
        .where(
          (role) => !assignedRoleIds.contains(role['id']?.toString() ?? ''),
        )
        .toList();
    return Material(
      color: Colors.transparent,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (error != null)
            Text(error!, style: const TextStyle(color: Colors.red)),
          Text('Current roles', style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 8),
          if (error == null && assignedRoles.isEmpty)
            const Text('No roles assigned.')
          else
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: assignedRoles
                  .map(
                    (role) => Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          role['name']?.toString() ??
                              role['code']?.toString() ??
                              'Unnamed',
                        ),
                        ElevatedButton(
                          onPressed: submitting
                              ? null
                              : () => _toggleRole(role, true),
                          child: const Text('Remove'),
                        ),
                      ],
                    ),
                  )
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
                  final name =
                      role['name']?.toString() ??
                      role['code']?.toString() ??
                      'Unnamed';
                  final description = role['description']?.toString() ?? '';
                  return ListTile(
                    title: Text(name),
                    subtitle: description.isNotEmpty ? Text(description) : null,
                    trailing: submitting
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : ElevatedButton(
                            onPressed: () => _toggleRole(role, false),
                            child: const Text('Assign'),
                          ),
                  );
                },
              ),
            ),
        ],
      ),
    );
  }
}
