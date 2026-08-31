import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'package:provider/provider.dart';

import '../../core/network/api_client.dart';
import '../../core/auth/auth_service.dart';
import '../../presentation/ui/components/page_header.dart';
import 'role_service.dart';

class RoleListScreen extends StatefulWidget {
  static const routeName = '/roles';
  const RoleListScreen({Key? key}) : super(key: key);

  @override
  State<RoleListScreen> createState() => _RoleListScreenState();
}

class _RoleListScreenState extends State<RoleListScreen> {
  late final AuthService _auth;
  late final RoleService _service;

  void _onServiceChanged() {
    if (mounted) setState(() {});
  }

  @override
  void initState() {
    super.initState();
    _auth = GetIt.instance.get<AuthService>();
    final apiClient = GetIt.instance.isRegistered<ApiClient>()
        ? GetIt.instance.get<ApiClient>()
        : ApiClient(baseUrl: 'http://localhost:3000');
    _service = RoleService(apiClient: apiClient);
    _service.addListener(_onServiceChanged);
    if (_auth.hasPermission('role.read') &&
        !_service.isLoading &&
        !_service.fetchedOnce &&
        _service.error == null) {
      _service.fetchRoles();
    }
  }

  @override
  void dispose() {
    _service.removeListener(_onServiceChanged);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_auth.hasPermission('role.read')) {
      return const Scaffold(
        body: Center(child: Text('You do not have permission to view roles.')),
      );
    }

    return ChangeNotifierProvider<RoleService>.value(
      value: _service,
      child: Consumer<RoleService>(
        builder: (context, svc, _) {
          final isSettingsRoute =
              ModalRoute.of(context)?.settings.name?.startsWith('/settings') ?? false;
          final breadcrumbs = <ErpBreadcrumbItem>[
            ErpBreadcrumbItem(
              label: isSettingsRoute ? 'Settings' : 'Dashboard',
              route: isSettingsRoute ? '/settings' : '/dashboard',
            ),
            const ErpBreadcrumbItem(label: 'Roles'),
          ];

          return Scaffold(
            body: CustomScrollView(
              slivers: [
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(24, 24, 24, 0),
                  sliver: SliverToBoxAdapter(
                    child: ErpPageHeader(
                      title: 'Roles',
                      subtitle: 'Manage security roles and access assignments',
                      breadcrumbs: breadcrumbs,
                      actions: _auth.hasPermission('role.manage')
                          ? [
                              FilledButton.icon(
                                onPressed: () => Navigator.pushNamed(
                                  context,
                                  '/settings/roles/create',
                                ),
                                icon: const Icon(Icons.add),
                                label: const Text('Add Role'),
                              ),
                            ]
                          : null,
                    ),
                  ),
                ),
                if (svc.isLoading)
                  const SliverFillRemaining(
                    hasScrollBody: false,
                    child: Center(child: CircularProgressIndicator()),
                  )
                else if (svc.error != null)
                  SliverFillRemaining(
                    hasScrollBody: false,
                    child: Center(
                      child: Text('Unable to load roles: ${svc.error}'),
                    ),
                  )
                else if (svc.roles.isEmpty)
                  const SliverFillRemaining(
                    hasScrollBody: false,
                    child: Center(child: Text('No roles found.')),
                  )
                else
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
                    sliver: SliverToBoxAdapter(
                      child: Card(
                        clipBehavior: Clip.antiAlias,
                        child: LayoutBuilder(
                          builder: (context, constraints) {
                            if (constraints.maxWidth < 700) {
                              return Column(
                                children: svc.roles
                                    .map((r) => _RoleTile(role: r, auth: _auth))
                                    .toList(),
                              );
                            }
                            return DataTable(
                              columnSpacing: 30,
                              horizontalMargin: 20,
                              headingRowHeight: 52,
                              dataRowMinHeight: 64,
                              dataRowMaxHeight: 76,
                              columns: const [
                                DataColumn(label: Text('Role')),
                                DataColumn(label: Text('Description')),
                                DataColumn(label: Text('Type')),
                                DataColumn(label: Text('Actions')),
                              ],
                              rows: svc.roles.map((r) {
                                final system = r['isSystem'] == true;
                                return DataRow(
                                  cells: [
                                    DataCell(
                                      Row(
                                        children: [
                                          CircleAvatar(
                                            radius: 12,
                                            child: Icon(
                                              system ? Icons.shield : Icons.badge_outlined,
                                              size: 15,
                                            ),
                                          ),
                                          const SizedBox(width: 10),
                                          Expanded(
                                            child: Text(
                                              r['name']?.toString() ?? r['code']?.toString() ?? 'Unnamed',
                                              style: const TextStyle(fontWeight: FontWeight.w600),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    DataCell(Text(r['description']?.toString() ?? '—')),
                                    DataCell(Text(system ? 'System' : 'Custom')),
                                    DataCell(_RoleActions(role: r, auth: _auth)),
                                  ],
                                );
                              }).toList(),
                            );
                          },
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _RoleTile extends StatelessWidget {
  final dynamic role;
  final AuthService auth;

  const _RoleTile({required this.role, required this.auth});

  @override
  Widget build(BuildContext context) => ListTile(
    contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
    leading: CircleAvatar(
      child: Icon(
        role['isSystem'] == true ? Icons.shield : Icons.badge_outlined,
        size: 19,
      ),
    ),
    title: Text(
      role['name']?.toString() ?? role['code']?.toString() ?? 'Unnamed',
      style: const TextStyle(fontWeight: FontWeight.w600),
    ),
    subtitle: Text(
      role['description']?.toString() ??
          (role['isSystem'] == true ? 'System role' : 'Custom role'),
    ),
    trailing: _RoleActions(role: role, auth: auth),
  );
}

class _RoleActions extends StatelessWidget {
  final dynamic role;
  final AuthService auth;

  const _RoleActions({required this.role, required this.auth});

  @override
  Widget build(BuildContext context) {
    final id = role['id']?.toString() ?? '';
    return Wrap(
      children: [
        if (auth.hasPermission('role.manage'))
          IconButton(
            icon: const Icon(Icons.edit_outlined),
            tooltip: 'Edit role',
            onPressed: () => Navigator.of(context).pushNamed(
              '/settings/roles/edit',
              arguments: id,
            ),
          ),
        if (auth.hasPermission('role.manage'))
          IconButton(
            icon: const Icon(Icons.admin_panel_settings_outlined),
            tooltip: 'Manage permissions',
            onPressed: () => Navigator.of(context).pushNamed(
              '/settings/roles/permissions',
              arguments: id,
            ),
          ),
      ],
    );
  }
}
