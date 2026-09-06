import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_service.dart';
import '../../core/network/api_client.dart';
import '../../presentation/ui/components/back_button.dart';
import '../role/role_service.dart';
import 'permission_metadata.dart';
import 'permission_service.dart';

enum _ActionGroup { common, business }

class RolePermissionScreen extends StatefulWidget {
  final String roleId;
  const RolePermissionScreen({Key? key, required this.roleId})
    : super(key: key);

  @override
  State<RolePermissionScreen> createState() => _RolePermissionScreenState();
}

class _RolePermissionScreenState extends State<RolePermissionScreen> {
  static const _commonActions = {
    'read',
    'create',
    'update',
    'cancel',
    'delete',
  };
  late final TextEditingController _searchController;
  String _category = 'All categories';
  _ActionGroup _group = _ActionGroup.common;
  String? _roleId;
  Set<String> _selected = {};
  Set<String> _initial = {};
  Set<String> _expandedModules = {};
  bool _initialized = false;
  bool _roleNotFound = false;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _searchController = TextEditingController();
    _roleId = widget.roleId.trim().isEmpty ? null : widget.roleId;
  }

  @override
  void didUpdateWidget(covariant RolePermissionScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.roleId != widget.roleId && widget.roleId.trim().isNotEmpty) {
      _roleId = widget.roleId;
      _initialized = false;
      _roleNotFound = false;
      _selected.clear();
      _initial.clear();
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadRole(RoleService service, String id) async {
    final role = await service.getRole(id);
    if (!mounted) return;
    if (role == null) {
      setState(() {
        _initialized = true;
        _roleNotFound = true;
        _selected = {};
        _initial = {};
      });
      return;
    }
    final assigned = await service.getRolePermissions(id);
    final keys = assigned
        .map(
          (e) => (e['permissionKey'] ?? e['permission_key'])?.toString() ?? '',
        )
        .where((e) => e.isNotEmpty)
        .toSet();
    if (!mounted) return;
    setState(() {
      _selected = keys;
      _initial = Set<String>.from(keys);
      _initialized = true;
      _roleNotFound = false;
    });
  }

  bool _isCommon(PermissionDescriptor p) =>
      _commonActions.contains(p.action.toLowerCase());

  String _actionLabel(String action) {
    switch (action.toLowerCase()) {
      case 'read':
        return 'View';
      case 'create':
        return 'Create';
      case 'update':
        return 'Update';
      case 'cancel':
        return 'Cancel';
      case 'delete':
        return 'Delete';
      default:
        return PermissionDescriptor.actionDisplayName(action);
    }
  }

  List<String> _actions(List<PermissionDescriptor> permissions) {
    final values = permissions.map((p) => p.action).toSet().toList();
    const order = ['read', 'create', 'update', 'cancel', 'delete'];
    values.sort((a, b) {
      final ai = order.indexOf(a.toLowerCase());
      final bi = order.indexOf(b.toLowerCase());
      if (ai >= 0 && bi >= 0) return ai.compareTo(bi);
      if (ai >= 0) return -1;
      if (bi >= 0) return 1;
      return _actionLabel(a).compareTo(_actionLabel(b));
    });
    return values;
  }

  void _set(Iterable<PermissionDescriptor> permissions, bool value) {
    setState(() {
      for (final p in permissions) {
        if (value) {
          _selected.add(p.permissionKey);
        } else {
          _selected.remove(p.permissionKey);
        }
      }
    });
  }

  Future<void> _save(RoleService service) async {
    final id = _roleId ?? widget.roleId;
    if (id.trim().isEmpty) return;
    final desired = _selected.toList()..sort();
    final initial = _initial.toList()..sort();
    final changed =
        desired.length != initial.length ||
        desired.asMap().entries.any((e) => e.value != initial[e.key]);
    if (!changed) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No permission changes to save.')),
      );
      return;
    }
    setState(() => _saving = true);
    await service.replacePermissionsForRole(id, desired);
    if (!mounted) return;
    final error = service.error;
    setState(() {
      _saving = false;
      if (error == null) _initial = Set<String>.from(desired);
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          error == null
              ? 'Permission assignment saved.'
              : 'Failed to save permission changes: $error',
        ),
      ),
    );
  }

  Widget _check({
    required String key,
    required bool? value,
    required ValueChanged<bool?>? onChanged,
  }) {
    return Checkbox(
      key: ValueKey('permission:$key'),
      value: value,
      tristate: value == null,
      onChanged: onChanged,
      visualDensity: VisualDensity.compact,
    );
  }

  DataCell _cell(PermissionDescriptor? permission, bool canManage) {
    if (permission == null) {
      return const DataCell(
        Center(
          child: Text('—', style: TextStyle(color: Colors.grey)),
        ),
      );
    }
    return DataCell(
      Center(
        child: _check(
          key: permission.permissionKey,
          value: _selected.contains(permission.permissionKey),
          onChanged: canManage
              ? (value) => setState(() {
                  if (value ?? false) {
                    _selected.add(permission.permissionKey);
                  } else {
                    _selected.remove(permission.permissionKey);
                  }
                })
              : null,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = GetIt.instance.get<AuthService>();
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(
          create: (_) =>
              PermissionService(apiClient: GetIt.instance.get<ApiClient>()),
        ),
        ChangeNotifierProvider(
          create: (_) =>
              RoleService(apiClient: GetIt.instance.get<ApiClient>()),
        ),
      ],
      child: Consumer2<PermissionService, RoleService>(
        builder: (context, permissions, roles, _) {
          final canManage =
              auth.hasPermission('role_permission.grant') &&
              auth.hasPermission('role_permission.revoke');
          if (!permissions.isLoading &&
              !permissions.fetchedOnce &&
              permissions.error == null) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (mounted) permissions.fetchPermissions();
            });
          }
          if (!roles.isLoading && !roles.fetchedOnce && roles.error == null) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (mounted) roles.fetchRoles();
            });
          }
          if ((_roleId == null || _roleId!.isEmpty) &&
              roles.roles.isNotEmpty &&
              !_initialized) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (!mounted) return;
              final id = roles.roles.first['id']?.toString() ?? '';
              if (id.isNotEmpty) setState(() => _roleId = id);
            });
          }
          if (_roleId != null &&
              _roleId!.isNotEmpty &&
              !_initialized &&
              !roles.isLoading &&
              roles.error == null) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (mounted) _loadRole(roles, _roleId!);
            });
          }

          final all = permissions.permissionDetails.isNotEmpty
              ? permissions.permissionDetails
              : permissions.permissions
                    .map(PermissionDescriptor.fromJson)
                    .toList(growable: false);
          final categories = [
            'All categories',
            ...PermissionDescriptor.buildMatrix(all).map((m) => m.displayName),
          ];
          final visible = all
              .where((p) {
                final groupMatch = _group == _ActionGroup.common
                    ? _isCommon(p)
                    : !_isCommon(p);
                final categoryMatch =
                    _category == 'All categories' || p.moduleName == _category;
                final query = _searchController.text.trim().toLowerCase();
                final searchMatch =
                    query.isEmpty ||
                    '${p.moduleName} ${p.resource} ${p.displayName} ${p.action}'
                        .toLowerCase()
                        .contains(query);
                return groupMatch && categoryMatch && searchMatch;
              })
              .toList(growable: false);
          final matrix = PermissionDescriptor.buildMatrix(visible);
          final actions = _actions(visible);

          if (permissions.isLoading ||
              roles.isLoading ||
              (_roleId != null && _roleId!.isNotEmpty && !_initialized)) {
            return const Scaffold(
              body: Center(child: CircularProgressIndicator()),
            );
          }
          if (permissions.error != null) {
            return Scaffold(
              appBar: AppBar(
                leading: SettingsBackButton(parentRoute: '/settings/roles'),
                title: const Text('Role permissions'),
              ),
              body: Center(
                child: Text('Error loading permissions: ${permissions.error}'),
              ),
            );
          }
          if (_roleNotFound) {
            return Scaffold(
              appBar: AppBar(
                leading: SettingsBackButton(parentRoute: '/settings/roles'),
                title: const Text('Role permissions'),
              ),
              body: const Center(
                child: Text(
                  'Role not found. Please return to the roles list and choose a valid role.',
                ),
              ),
            );
          }

          final roleItems = roles.roles
              .map(
                (role) => DropdownMenuItem<String>(
                  value: role['id']?.toString() ?? '',
                  child: Text(
                    role['name']?.toString() ??
                        role['code']?.toString() ??
                        'Unnamed role',
                  ),
                ),
              )
              .toList(growable: false);

          final rows = <DataRow>[];
          for (final module in matrix) {
            final modulePermissions = module.resources
                .expand((r) => r.actions.map((a) => r.permissionFor(a)!))
                .toList(growable: false);
            final selectedCount = modulePermissions
                .where((p) => _selected.contains(p.permissionKey))
                .length;
            final allSelected =
                modulePermissions.isNotEmpty &&
                selectedCount == modulePermissions.length;
            final someSelected = selectedCount > 0 && !allSelected;
            final expanded = _expandedModules.contains(module.moduleCode);

            rows.add(
              DataRow(
                cells: [
                  DataCell(
                    SizedBox(
                      width: 320,
                      child: Row(
                        children: [
                          IconButton(
                            visualDensity: VisualDensity.compact,
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints.tightFor(
                              width: 28,
                              height: 28,
                            ),
                            icon: Icon(
                              expanded
                                  ? Icons.keyboard_arrow_down
                                  : Icons.keyboard_arrow_right,
                            ),
                            onPressed: () => setState(() {
                              if (!(_expandedModules.remove(module.moduleCode)))
                                _expandedModules.add(module.moduleCode);
                            }),
                          ),
                          Expanded(
                            child: Text(
                              module.displayName,
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                          if (canManage)
                            _check(
                              key: 'module:${module.moduleCode}',
                              value: allSelected
                                  ? true
                                  : (someSelected ? null : false),
                              onChanged: (v) =>
                                  _set(modulePermissions, v ?? true),
                            ),
                        ],
                      ),
                    ),
                  ),
                  ...actions.map((action) {
                    final actionPermissions = module.resources
                        .map((r) => r.permissionFor(action))
                        .whereType<PermissionDescriptor>()
                        .toList(growable: false);
                    final count = actionPermissions
                        .where((p) => _selected.contains(p.permissionKey))
                        .length;
                    final allAction =
                        actionPermissions.isNotEmpty &&
                        count == actionPermissions.length;
                    final someAction = count > 0 && !allAction;
                    return DataCell(
                      Center(
                        child: canManage
                            ? _check(
                                key: 'module:${module.moduleCode}:$action',
                                value: allAction
                                    ? true
                                    : (someAction ? null : false),
                                onChanged: (v) =>
                                    _set(actionPermissions, v ?? true),
                              )
                            : (allAction
                                  ? const Icon(Icons.check, size: 18)
                                  : const SizedBox.shrink()),
                      ),
                    );
                  }),
                ],
              ),
            );

            if (!expanded) continue;
            for (final resource in module.resources) {
              final resourcePermissions = resource.actions
                  .map((a) => resource.permissionFor(a)!)
                  .toList(growable: false);
              final count = resourcePermissions
                  .where((p) => _selected.contains(p.permissionKey))
                  .length;
              final allResource =
                  resourcePermissions.isNotEmpty &&
                  count == resourcePermissions.length;
              final someResource = count > 0 && !allResource;
              rows.add(
                DataRow(
                  cells: [
                    DataCell(
                      SizedBox(
                        width: 320,
                        child: Row(
                          children: [
                            const SizedBox(width: 40),
                            Expanded(child: Text(resource.displayName)),
                            if (canManage)
                              _check(
                                key:
                                    'resource:${module.moduleCode}:${resource.resourceCode}',
                                value: allResource
                                    ? true
                                    : (someResource ? null : false),
                                onChanged: (v) =>
                                    _set(resourcePermissions, v ?? true),
                              ),
                          ],
                        ),
                      ),
                    ),
                    ...actions.map(
                      (action) =>
                          _cell(resource.permissionFor(action), canManage),
                    ),
                  ],
                ),
              );
            }
          }

          return Scaffold(
            appBar: AppBar(
              leading: SettingsBackButton(parentRoute: '/settings/roles'),
              title: const Text('Role permissions'),
            ),
            body: SafeArea(
              child: Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
                    child: Row(
                      children: [
                        Expanded(
                          child: DropdownButtonFormField<String>(
                            key: const ValueKey('role-selector'),
                            isExpanded: true,
                            initialValue:
                                roleItems.any((i) => i.value == _roleId)
                                ? _roleId
                                : null,
                            hint: const Text('Select role'),
                            decoration: const InputDecoration(
                              labelText: 'Role',
                              border: OutlineInputBorder(),
                            ),
                            items: roleItems,
                            onChanged: canManage
                                ? (v) {
                                    if (v == null || v.isEmpty) return;
                                    setState(() {
                                      _roleId = v;
                                      _initialized = false;
                                      _selected.clear();
                                      _initial.clear();
                                    });
                                  }
                                : null,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: DropdownButtonFormField<String>(
                            key: const ValueKey('category-selector'),
                            isExpanded: true,
                            initialValue: categories.contains(_category)
                                ? _category
                                : 'All categories',
                            decoration: const InputDecoration(
                              labelText: 'Category',
                              border: OutlineInputBorder(),
                            ),
                            items: categories
                                .map(
                                  (c) => DropdownMenuItem(
                                    value: c,
                                    child: Text(c),
                                  ),
                                )
                                .toList(),
                            onChanged: (v) => setState(
                              () => _category = v ?? 'All categories',
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: DropdownButtonFormField<_ActionGroup>(
                            key: const ValueKey('action-type-selector'),
                            isExpanded: true,
                            initialValue: _group,
                            decoration: const InputDecoration(
                              labelText: 'Action type',
                              border: OutlineInputBorder(),
                            ),
                            items: const [
                              DropdownMenuItem(
                                value: _ActionGroup.common,
                                child: Text('Common Actions'),
                              ),
                              DropdownMenuItem(
                                value: _ActionGroup.business,
                                child: Text('Business Actions'),
                              ),
                            ],
                            onChanged: (v) => setState(
                              () => _group = v ?? _ActionGroup.common,
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        FilledButton.icon(
                          onPressed: canManage && !_saving
                              ? () => _save(roles)
                              : null,
                          icon: const Icon(Icons.save_outlined),
                          label: Text(_saving ? 'Saving...' : 'Save'),
                        ),
                      ],
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
                  Expanded(
                    child: matrix.isEmpty
                        ? const Center(
                            child: Text(
                              'No permissions match the selected action type and filters.',
                            ),
                          )
                        : Padding(
                            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                            child: Card(
                              clipBehavior: Clip.antiAlias,
                              child: Scrollbar(
                                child: SingleChildScrollView(
                                  scrollDirection: Axis.horizontal,
                                  child: SingleChildScrollView(
                                    child: DataTable(
                                      columnSpacing: 28,
                                      headingRowHeight: 44,
                                      dataRowMinHeight: 44,
                                      dataRowMaxHeight: 56,
                                      columns: [
                                        DataColumn(
                                          label: const Text('Permissions'),
                                        ),
                                        ...actions.map(
                                          (a) => DataColumn(
                                            label: Text(_actionLabel(a)),
                                          ),
                                        ),
                                      ],
                                      rows: rows,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
