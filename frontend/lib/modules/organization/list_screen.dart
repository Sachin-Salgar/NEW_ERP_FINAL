import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_service.dart';
import '../../core/network/api_client.dart';
import '../../presentation/ui/components/page_header.dart';
import 'organization_service.dart';

class OrganizationListScreen extends StatefulWidget {
  const OrganizationListScreen({super.key});

  @override
  State<OrganizationListScreen> createState() => _OrganizationListScreenState();
}

class _OrganizationListScreenState extends State<OrganizationListScreen> {
  late final OrganizationService service;
  late final AuthService auth;

  @override
  void initState() {
    super.initState();
    final baseUrl = const String.fromEnvironment('API_BASE_URL', defaultValue: 'http://localhost:3000');
    service = OrganizationService(apiClient: ApiClient(baseUrl: baseUrl));
    auth = GetIt.instance.get<AuthService>();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _init();
    });
  }

  Future<void> _init() async {
    await auth.fetchEffectivePermissions(const String.fromEnvironment('API_BASE_URL', defaultValue: 'http://localhost:3000'));
    if (!mounted) return;
    await service.fetchOrganizations();
  }

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider<OrganizationService>.value(
      value: service,
      child: Consumer<OrganizationService>(builder: (context, svc, _) {
        final theme = Theme.of(context);
        if (svc.isLoading) return const Center(child: CircularProgressIndicator());
        if (svc.error != null) return _Message(message: 'Unable to load organizations: ${svc.error}');
        if (!auth.hasPermission('organization.read')) return const _Message(message: 'You do not have permission to view organizations.');

        final items = svc.organizations;
        return Scaffold(
          body: RefreshIndicator(
            onRefresh: svc.fetchOrganizations,
            child: CustomScrollView(slivers: [
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(24, 24, 24, 0),
                sliver: SliverToBoxAdapter(child: ErpPageHeader(
                  title: 'Organizations',
                  subtitle: 'Manage organizations in the ERP',
                  breadcrumbs: const [ErpBreadcrumbItem(label: 'Dashboard'), ErpBreadcrumbItem(label: 'Organizations')],
                  actions: auth.hasPermission('organization.manage')
                      ? [FilledButton.icon(onPressed: () => Navigator.of(context).pushNamed('/settings/organizations/create'), icon: const Icon(Icons.add), label: const Text('Add Organization'))]
                      : null,
                )),
              ),
              if (items.isEmpty)
                const SliverFillRemaining(hasScrollBody: false, child: _Message(message: 'No organizations found.'))
              else
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
                  sliver: SliverToBoxAdapter(child: Card(
                    clipBehavior: Clip.antiAlias,
                    child: LayoutBuilder(builder: (context, constraints) {
                      final compact = constraints.maxWidth < 650;
                      return compact
                              ? Column(children: items.map((org) => _OrganizationTile(org: org, onTap: () => Navigator.of(context).pushNamed('/settings/organizations/details', arguments: org['id']))).toList())
                          : DataTable(
                              columnSpacing: 28,
                              horizontalMargin: 20,
                              headingRowHeight: 52,
                              dataRowMinHeight: 62,
                              dataRowMaxHeight: 72,
                              columns: const [DataColumn(label: Text('Organization')), DataColumn(label: Text('Legal name')), DataColumn(label: Text('Code')), DataColumn(label: Text(''))],
                              rows: items.map((org) => DataRow(cells: [
                                DataCell(Text(org['name'] ?? org['code'] ?? 'Unnamed', style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600))),
                                DataCell(Text(org['legalName'] ?? '')),
                                DataCell(Text(org['code'] ?? '—')),
                                DataCell(IconButton(onPressed: () => Navigator.of(context).pushNamed('/settings/organizations/details', arguments: org['id']), icon: const Icon(Icons.chevron_right))),
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

class _OrganizationTile extends StatelessWidget {
  final dynamic org;
  final VoidCallback onTap;
  const _OrganizationTile({required this.org, required this.onTap});
  @override
  Widget build(BuildContext context) => ListTile(
    contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
    leading: CircleAvatar(child: Text((org['name'] ?? org['code'] ?? '?').toString().substring(0, 1).toUpperCase())),
    title: Text(org['name'] ?? org['code'] ?? 'Unnamed', style: const TextStyle(fontWeight: FontWeight.w600)),
    subtitle: Text(org['legalName'] ?? org['code'] ?? ''),
    trailing: const Icon(Icons.chevron_right),
    onTap: onTap,
  );
}

class _Message extends StatelessWidget {
  final String message;
  const _Message({required this.message});
  @override
  Widget build(BuildContext context) => Center(child: Padding(padding: const EdgeInsets.all(32), child: Text(message)));
}
