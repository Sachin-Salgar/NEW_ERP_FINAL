import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_service.dart';
import '../../core/network/api_client.dart';
import '../../presentation/ui/components/page_header.dart';
import 'branch_service.dart';

class BranchListScreen extends StatefulWidget {
  final String organizationId;
  const BranchListScreen({super.key, required this.organizationId});
  @override
  State<BranchListScreen> createState() => _BranchListScreenState();
}

class _BranchListScreenState extends State<BranchListScreen> {
  late final BranchService service;
  late final AuthService auth;

  @override
  void initState() {
    super.initState();
    service = BranchService(apiClient: GetIt.instance.get<ApiClient>());
    auth = GetIt.instance.get<AuthService>();
    _init();
  }

  Future<void> _init() async {
    final baseUrl = const String.fromEnvironment('API_BASE_URL', defaultValue: 'http://localhost:3000');
    await auth.fetchEffectivePermissions(baseUrl);
    await service.fetchBranches(widget.organizationId);
  }

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider<BranchService>.value(
      value: service,
      child: Consumer<BranchService>(builder: (context, svc, _) {
        if (svc.isLoading) return const Center(child: CircularProgressIndicator());
        if (svc.error != null) return _Message(message: 'Unable to load branches: ${svc.error}');
        if (!auth.hasPermission('branch.read')) return const _Message(message: 'You do not have permission to view branches.');
        final items = svc.branches;
        return Scaffold(
          body: RefreshIndicator(
            onRefresh: () => svc.fetchBranches(widget.organizationId),
            child: CustomScrollView(slivers: [
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(24, 24, 24, 0),
                sliver: SliverToBoxAdapter(child: ErpPageHeader(
                  title: 'Branches',
                  subtitle: 'Branches for this organization',
                  breadcrumbs: const [ErpBreadcrumbItem(label: 'Dashboard'), ErpBreadcrumbItem(label: 'Organizations'), ErpBreadcrumbItem(label: 'Branches')],
                  actions: auth.hasPermission('branch.manage') ? [FilledButton.icon(
                   onPressed: () => Navigator.of(context).pushNamed('/settings/branches/create', arguments: widget.organizationId),
                    icon: const Icon(Icons.add), label: const Text('Add Branch'),
                  )] : null,
                )),
              ),
              if (items.isEmpty)
                const SliverFillRemaining(hasScrollBody: false, child: _Message(message: 'No branches found.'))
              else
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
                  sliver: SliverToBoxAdapter(child: Card(
                    clipBehavior: Clip.antiAlias,
                    child: LayoutBuilder(builder: (context, constraints) {
                      if (constraints.maxWidth < 650) {
                        return Column(children: items.map((b) => ListTile(
                          contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
                          leading: CircleAvatar(child: const Icon(Icons.store_outlined, size: 19)),
                          title: Text(b['name'] ?? b['code'] ?? 'Unnamed', style: const TextStyle(fontWeight: FontWeight.w600)),
                          subtitle: Text(b['city'] ?? b['code'] ?? ''),
                          trailing: const Icon(Icons.chevron_right),
                          onTap: () => Navigator.of(context).pushNamed('/settings/branches/details', arguments: {'organizationId': widget.organizationId, 'branchId': b['id']}),
                        )).toList());
                      }
                      return DataTable(
                        columnSpacing: 30,
                        horizontalMargin: 20,
                        headingRowHeight: 52,
                        dataRowMinHeight: 62,
                        dataRowMaxHeight: 72,
                        columns: const [DataColumn(label: Text('Branch')), DataColumn(label: Text('Code')), DataColumn(label: Text('City')), DataColumn(label: Text(''))],
                        rows: items.map((b) => DataRow(cells: [
                          DataCell(Text(b['name'] ?? b['code'] ?? 'Unnamed', style: const TextStyle(fontWeight: FontWeight.w600))),
                          DataCell(Text(b['code'] ?? '—')),
                          DataCell(Text(b['city'] ?? '—')),
                          DataCell(IconButton(onPressed: () => Navigator.of(context).pushNamed('/settings/branches/details', arguments: {'organizationId': widget.organizationId, 'branchId': b['id']}), icon: const Icon(Icons.chevron_right))),
                        ])).toList(),
                      );
                    }),
                  )),
                ),
            ]),
          ),
        );
      }),
    );
  }
}

class _Message extends StatelessWidget {
  final String message;
  const _Message({required this.message});
  @override
  Widget build(BuildContext context) => Center(child: Padding(padding: const EdgeInsets.all(32), child: Text(message)));
}
