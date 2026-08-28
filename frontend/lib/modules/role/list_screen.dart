import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'package:provider/provider.dart';

import '../../core/network/api_client.dart';
import '../../core/auth/auth_service.dart';
import '../../presentation/ui/components/page_header.dart';
import 'role_service.dart';
import 'edit_screen.dart';
import '../permission/role_permission_screen.dart';

class RoleListScreen extends StatelessWidget {
  static const routeName = '/roles';
  const RoleListScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final auth = GetIt.instance.get<AuthService>();
    return ChangeNotifierProvider(
      create: (_) => RoleService(apiClient: GetIt.instance.get<ApiClient>()),
      child: Consumer<RoleService>(builder: (context, svc, _) {
        if (!auth.hasPermission('role.read')) return const Scaffold(body: Center(child: Text('You do not have permission to view roles.')));
        if (!svc.isLoading && !svc.fetchedOnce && svc.error == null) {
          WidgetsBinding.instance.addPostFrameCallback((_) => svc.fetchRoles());
        }
        return Scaffold(body: CustomScrollView(slivers: [
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(24, 24, 24, 0),
            sliver: SliverToBoxAdapter(child: ErpPageHeader(
              title: 'Roles',
              subtitle: 'Manage security roles and access assignments',
              breadcrumbs: const [ErpBreadcrumbItem(label: 'Dashboard'), ErpBreadcrumbItem(label: 'Roles')],
            )),
          ),
          if (svc.isLoading)
            const SliverFillRemaining(hasScrollBody: false, child: Center(child: CircularProgressIndicator()))
          else if (svc.error != null)
            SliverFillRemaining(hasScrollBody: false, child: Center(child: Text('Unable to load roles: ${svc.error}')))
          else if (svc.roles.isEmpty)
            const SliverFillRemaining(hasScrollBody: false, child: Center(child: Text('No roles found.')))
          else
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
              sliver: SliverToBoxAdapter(child: Card(
                clipBehavior: Clip.antiAlias,
                child: LayoutBuilder(builder: (context, constraints) {
                  if (constraints.maxWidth < 700) return Column(children: svc.roles.map((r) => _RoleTile(role: r, auth: auth)).toList());
                  return DataTable(
                    columnSpacing: 30, horizontalMargin: 20, headingRowHeight: 52, dataRowMinHeight: 64, dataRowMaxHeight: 76,
                    columns: const [DataColumn(label: Text('Role')), DataColumn(label: Text('Description')), DataColumn(label: Text('Type')), DataColumn(label: Text('Actions'))],
                    rows: svc.roles.map((r) {
                      final system = r['isSystem'] == true;
                      return DataRow(cells: [
                        DataCell(Text(r['name']?.toString() ?? r['code']?.toString() ?? 'Unnamed', style: const TextStyle(fontWeight: FontWeight.w600))),
                        DataCell(Text(r['description']?.toString() ?? '—')),
                        DataCell(Text(system ? 'System' : 'Custom')),
                        DataCell(_RoleActions(role: r, auth: auth)),
                      ]);
                    }).toList(),
                  );
                }),
              )),
            ),
        ]));
      }),
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
    leading: CircleAvatar(child: Icon(role['isSystem'] == true ? Icons.shield_outlined : Icons.badge_outlined, size: 19)),
    title: Text(role['name']?.toString() ?? role['code']?.toString() ?? 'Unnamed', style: const TextStyle(fontWeight: FontWeight.w600)),
    subtitle: Text(role['description']?.toString() ?? (role['isSystem'] == true ? 'System role' : 'Custom role')),
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
    return Wrap(mainAxisSize: MainAxisSize.min, children: [
      if (auth.hasPermission('role.manage')) IconButton(icon: const Icon(Icons.edit_outlined), tooltip: 'Edit role', onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => RoleEditScreen(roleId: id)))),
      if (auth.hasPermission('role.manage')) IconButton(icon: const Icon(Icons.admin_panel_settings_outlined), tooltip: 'Manage permissions', onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => RolePermissionScreen(roleId: id)))),
    ]);
  }
}
