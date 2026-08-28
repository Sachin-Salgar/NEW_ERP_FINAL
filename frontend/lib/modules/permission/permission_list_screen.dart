import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'package:provider/provider.dart';

import '../../core/network/api_client.dart';
import '../../core/auth/auth_service.dart';
import '../../presentation/ui/components/page_header.dart';
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
        if (!auth.hasPermission('permission.read')) return const Scaffold(body: Center(child: Text('You do not have permission to view permissions.')));
        if (!svc.isLoading && !svc.fetchedOnce && svc.error == null) WidgetsBinding.instance.addPostFrameCallback((_) => svc.fetchPermissions());
        return Scaffold(body: CustomScrollView(slivers: [
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(24, 24, 24, 0),
            sliver: SliverToBoxAdapter(child: ErpPageHeader(
              title: 'Permissions',
              subtitle: 'Browse and inspect available system permissions',
              breadcrumbs: const [ErpBreadcrumbItem(label: 'Dashboard'), ErpBreadcrumbItem(label: 'Permissions')],
            )),
          ),
          if (svc.isLoading)
            const SliverFillRemaining(hasScrollBody: false, child: Center(child: CircularProgressIndicator()))
          else if (svc.error != null)
            SliverFillRemaining(hasScrollBody: false, child: Center(child: Text('Unable to load permissions: ${svc.error}')))
          else if (svc.permissions.isEmpty)
            const SliverFillRemaining(hasScrollBody: false, child: Center(child: Text('No permissions found.')))
          else
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
              sliver: SliverToBoxAdapter(child: Card(
                clipBehavior: Clip.antiAlias,
                child: LayoutBuilder(builder: (context, constraints) {
                  if (constraints.maxWidth < 700) return Column(children: svc.permissions.map((key) => ListTile(
                    contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 5),
                    leading: CircleAvatar(child: const Icon(Icons.lock_outline, size: 18)),
                    title: Text(key, style: const TextStyle(fontWeight: FontWeight.w600)),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => PermissionDetailScreen(permissionKey: key))),
                  )).toList());
                  return DataTable(
                    columnSpacing: 30, horizontalMargin: 20, headingRowHeight: 52, dataRowMinHeight: 62, dataRowMaxHeight: 72,
                    columns: const [DataColumn(label: Text('Permission')), DataColumn(label: Text('Action'))],
                    rows: svc.permissions.map((key) => DataRow(cells: [
                      DataCell(Text(key, style: const TextStyle(fontWeight: FontWeight.w600))),
                      DataCell(IconButton(icon: const Icon(Icons.chevron_right), tooltip: 'View details', onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => PermissionDetailScreen(permissionKey: key))))),
                    ])).toList(),
                  );
                }),
              )),
            ),
        ]));
      }),
    );
  }
}
