import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_service.dart';
import '../../core/network/api_client.dart';
import '../../presentation/ui/components/back_button.dart';
import '../role/role_service.dart';
import 'permission_metadata.dart';
import 'permission_service.dart';

class RolePermissionScreen extends StatefulWidget {
  final String roleId;
  const RolePermissionScreen({Key? key, required this.roleId}) : super(key: key);

  @override
  State<RolePermissionScreen> createState() => _RolePermissionScreenState();
}

class _RolePermissionScreenState extends State<RolePermissionScreen> {
  late final TextEditingController _searchController;
  String _moduleFilter = 'All modules';
  bool _saving = false;
  bool _initialized = false;
  bool _roleNotFound = false;
  String? _selectedRoleId;
  Set<String> _selectedPermissions = {};
  Set<String> _initialPermissions = {};

  @override
  void initState() {
    super.initState();
    _searchController = TextEditingController();
    _selectedRoleId = widget.roleId.trim().isEmpty ? null : widget.roleId;
  }

  @override
  void didUpdateWidget(covariant RolePermissionScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.roleId != widget.roleId && widget.roleId.trim().isNotEmpty) {
      _selectedRoleId = widget.roleId;
      _initialized = false;
      _roleNotFound = false;
      _selectedPermissions.clear();
      _initialPermissions.clear();
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadPermissions(RoleService roleSvc, String roleId) async {
    final permissions = await roleSvc.getRolePermissions(roleId);
    final assigned = permissions
        .map((entry) => (entry['permissionKey'] ?? entry['permission_key'])?.toString() ?? '')
        .where((key) => key.isNotEmpty)
        .toSet();

    if (!mounted) return;
    setState(() {
      _initialPermissions = assigned;
      _selectedPermissions = Set<String>.from(assigned);
      _initialized = true;
      _roleNotFound = false;
    });
  }

  Future<void> _loadRoleContext(RoleService roleSvc, String roleId) async {
    final role = await roleSvc.getRole(roleId);
    if (!mounted) return;

    if (role == null) {
      setState(() {
        _initialized = true;
        _roleNotFound = true;
        _selectedPermissions = {};
        _initialPermissions = {};
      });
      return;
    }

    await _loadPermissions(roleSvc, roleId);
  }

  void _togglePermission(String key, bool value) {
    setState(() {
      if (value) {
        _selectedPermissions.add(key);
      } else {
        _selectedPermissions.remove(key);
      }
    });
  }

  void _toggleModule(List<PermissionDescriptor> permissions, bool value) {
    setState(() {
      for (final permission in permissions) {
        if (value) {
          _selectedPermissions.add(permission.permissionKey);
        } else {
          _selectedPermissions.remove(permission.permissionKey);
        }
      }
    });
  }

  Future<void> _save(RoleService roleSvc) async {
    final roleId = _selectedRoleId ?? widget.roleId;
    if (roleId.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Select a role before saving.')),
      );
      return;
    }

    final desiredPermissions = _selectedPermissions.toList()..sort();
    final initialPermissions = _initialPermissions.toList()..sort();
    final hasChanges = desiredPermissions.length != initialPermissions.length ||
        desiredPermissions.asMap().entries.any((entry) => entry.value != initialPermissions[entry.key]);
    if (!hasChanges) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('No permission changes to save.')),
        );
      }
      return;
    }

    setState(() => _saving = true);

    await roleSvc.replacePermissionsForRole(roleId, desiredPermissions);

    if (!mounted) return;

    final hasError = roleSvc.error != null;
    setState(() {
      _saving = false;
      if (!hasError) {
        _initialPermissions = Set<String>.from(desiredPermissions);
      }
    });

    if (hasError) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to save permission changes: ${roleSvc.error}')),
      );
      return;
    }

    await _loadPermissions(roleSvc, roleId);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Permission assignment saved.')),
    );
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

        if (!permSvc.isLoading && !permSvc.fetchedOnce && permSvc.error == null) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) permSvc.fetchPermissions();
          });
        }

        if (!roleSvc.isLoading && !roleSvc.fetchedOnce && roleSvc.error == null) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) roleSvc.fetchRoles();
          });
        }

        if ((_selectedRoleId == null || _selectedRoleId!.isEmpty) && roleSvc.roles.isNotEmpty && !_initialized) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (!mounted) return;
            final firstRoleId = roleSvc.roles.first['id']?.toString() ?? '';
            if (firstRoleId.isNotEmpty && _selectedRoleId != firstRoleId) {
              setState(() {
                _selectedRoleId = firstRoleId;
                _initialized = false;
              });
            }
          });
        }

        if (_selectedRoleId != null &&
            _selectedRoleId!.isNotEmpty &&
            !_initialized &&
            !roleSvc.isLoading &&
            roleSvc.error == null) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) _loadRoleContext(roleSvc, _selectedRoleId!);
          });
        }

        final allPermissions = permSvc.permissionDetails.isNotEmpty
            ? permSvc.permissionDetails
            : permSvc.permissions.map(PermissionDescriptor.fromJson).toList(growable: false);

        final groups = PermissionDescriptor.groupByModule(allPermissions);
        final moduleNames = ['All modules', ...groups.keys.toList()];

        final visiblePermissions = allPermissions.where((permission) {
          final moduleMatches = _moduleFilter == 'All modules' || permission.moduleName == _moduleFilter;
          final query = _searchController.text.trim().toLowerCase();
          final textMatches = query.isEmpty ||
              '${permission.displayName} ${permission.moduleName}'.toLowerCase().contains(query);
          return moduleMatches && textMatches;
        }).toList(growable: false);

        final visibleGroups = PermissionDescriptor.groupByModule(visiblePermissions);

        if (permSvc.isLoading || roleSvc.isLoading || (_selectedRoleId != null && _selectedRoleId!.isNotEmpty && !_initialized)) {
          return const Scaffold(
            appBar: PreferredSize(
              preferredSize: Size.fromHeight(kToolbarHeight),
              child: SafeArea(child: SizedBox.shrink()),
            ),
            body: Center(child: CircularProgressIndicator()),
          );
        }

        if (permSvc.error != null) {
          return Scaffold(
            appBar: AppBar(
              leading: SettingsBackButton(parentRoute: '/settings/roles'),
              title: const Text('Role permissions'),
            ),
            body: Center(child: Text('Error loading permissions: ${permSvc.error}')),
          );
        }

        if (_roleNotFound) {
          return Scaffold(
            appBar: AppBar(
              leading: SettingsBackButton(parentRoute: '/settings/roles'),
              title: const Text('Role permissions'),
            ),
            body: Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(
                  'Role not found. Please return to the roles list and choose a valid role.',
                  textAlign: TextAlign.center,
                ),
              ),
            ),
          );
        }

        final roleOptions = roleSvc.roles
            .map((role) => DropdownMenuItem<String>(
                  value: role['id']?.toString() ?? '',
                  child: Text(role['name']?.toString() ?? role['code']?.toString() ?? 'Unnamed role'),
                ))
            .toList(growable: false);

        return Scaffold(
          appBar: AppBar(
            leading: SettingsBackButton(parentRoute: '/settings/roles'),
            title: const Text('Role permissions'),
          ),
          body: SafeArea(
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Role permissions',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 4),
                      Text('Select a role, filter by module, and update the permissions for that role.'),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                  child: Row(
                    children: [
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          initialValue: roleOptions.any((item) => item.value == _selectedRoleId) ? _selectedRoleId : null,
                          hint: const Text('Select a role'),
                          decoration: const InputDecoration(
                            labelText: 'Role',
                            border: OutlineInputBorder(),
                          ),
                          items: roleOptions,
                          onChanged: canManage && roleOptions.isNotEmpty
                              ? (value) {
                                  if (value == null || value.isEmpty) return;
                                  setState(() {
                                    _selectedRoleId = value;
                                    _initialized = false;
                                    _selectedPermissions.clear();
                                    _initialPermissions.clear();
                                  });
                                }
                              : null,
                        ),
                      ),
                      if (canManage && _selectedRoleId != null && _selectedRoleId!.isNotEmpty) ...[
                        const SizedBox(width: 12),
                        SizedBox(
                          width: 148,
                          child: FilledButton.icon(
                            onPressed: _saving ? null : () => _save(roleSvc),
                            icon: const Icon(Icons.save_outlined),
                            label: Text(_saving ? 'Saving...' : 'Save'),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                if (_selectedRoleId == null || _selectedRoleId!.isEmpty)
                  const Padding(
                    padding: EdgeInsets.fromLTRB(16, 8, 16, 0),
                    child: Text('No role selected. Choose a role to begin managing permissions.'),
                  )
                else ...[
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                    child: DropdownButtonFormField<String>(
                      initialValue: moduleNames.contains(_moduleFilter) ? _moduleFilter : 'All modules',
                      decoration: const InputDecoration(
                        labelText: 'Module filter',
                        border: OutlineInputBorder(),
                      ),
                      items: moduleNames
                          .map((module) => DropdownMenuItem(value: module, child: Text(module)))
                          .toList(),
                      onChanged: (value) => setState(() => _moduleFilter = value ?? 'All modules'),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                    child: TextField(
                      controller: _searchController,
                      decoration: const InputDecoration(
                        hintText: 'Search permissions',
                        prefixIcon: Icon(Icons.search_outlined),
                        border: OutlineInputBorder(),
                      ),
                      onChanged: (_) => setState(() {}),
                    ),
                  ),
                  if (canManage)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                      child: Row(
                        children: [
                          OutlinedButton(
                            onPressed: () => setState(() {
                              for (final permission in visiblePermissions) {
                                _selectedPermissions.add(permission.permissionKey);
                              }
                            }),
                            child: const Text('Select visible'),
                          ),
                          const SizedBox(width: 8),
                          OutlinedButton(
                            onPressed: () => setState(() {
                              for (final permission in visiblePermissions) {
                                _selectedPermissions.remove(permission.permissionKey);
                              }
                            }),
                            child: const Text('Clear visible'),
                          ),
                        ],
                      ),
                    ),
                  Expanded(
                    child: visibleGroups.isEmpty
                        ? const Center(child: Text('No permissions match the current filter.'))
                        : ListView(
                            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                            children: visibleGroups.entries.map((entry) {
                              final moduleName = entry.key;
                              final permissions = entry.value;
                              final selectedCount = permissions.where((permission) => _selectedPermissions.contains(permission.permissionKey)).length;
                              final allSelected = selectedCount == permissions.length && permissions.isNotEmpty;
                              final someSelected = selectedCount > 0 && !allSelected;

                              return Card(
                                margin: const EdgeInsets.only(bottom: 14),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Padding(
                                      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                                      child: Row(
                                        children: [
                                          Expanded(
                                            child: Text(
                                              moduleName,
                                              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                                                fontWeight: FontWeight.w700,
                                              ),
                                            ),
                                          ),
                                          if (canManage)
                                            Checkbox(
                                              value: allSelected ? true : (someSelected ? null : false),
                                              tristate: true,
                                              onChanged: (value) {
                                                final nextValue = value ?? true;
                                                _toggleModule(permissions, nextValue);
                                              },
                                            ),
                                        ],
                                      ),
                                    ),
                                    ...permissions.map((permission) {
                                      final isChecked = _selectedPermissions.contains(permission.permissionKey);
                                      return CheckboxListTile(
                                        controlAffinity: ListTileControlAffinity.leading,
                                        value: isChecked,
                                        onChanged: canManage
                                            ? (value) => _togglePermission(permission.permissionKey, value ?? false)
                                            : null,
                                        title: Text(permission.displayName),
                                        subtitle: permission.description != null && permission.description!.isNotEmpty
                                            ? Text(permission.description!)
                                            : Text(permission.action.toUpperCase()),
                                        secondary: Icon(
                                          permission.action == 'read'
                                              ? Icons.visibility_outlined
                                              : permission.action == 'create'
                                                  ? Icons.add_circle_outline
                                                  : permission.action == 'update'
                                                      ? Icons.edit_outlined
                                                      : permission.action == 'delete'
                                                          ? Icons.delete_outline
                                                          : Icons.lock_outline,
                                        ),
                                      );
                                    }),
                                  ],
                                ),
                              );
                            }).toList(),
                          ),
                  ),
                ],
              ],
            ),
          ),
        );
      }),
    );
  }
}
