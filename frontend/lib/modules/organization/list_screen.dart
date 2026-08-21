import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_service.dart';
import '../../core/network/api_client.dart';
import 'organization_service.dart';
import '../../presentation/ui/components/page_header.dart';

class OrganizationListScreen extends StatefulWidget {
  const OrganizationListScreen({Key? key}) : super(key: key);

  @override
  State<OrganizationListScreen> createState() => _OrganizationListScreenState();
}

class _OrganizationListScreenState extends State<OrganizationListScreen> {
  late OrganizationService service;
  late AuthService auth;

  @override
  void initState() {
    super.initState();
    final api = ApiClient(
      baseUrl: const String.fromEnvironment(
        'API_BASE_URL',
        defaultValue: 'http://localhost:3001',
      ),
    );
    service = OrganizationService(apiClient: api);
    auth = GetIt.instance.get<AuthService>();
    _init();
  }

  Future<void> _init() async {
    await auth.fetchEffectivePermissions(
      const String.fromEnvironment(
        'API_BASE_URL',
        defaultValue: 'http://localhost:3001',
      ),
    );
    await service.fetchOrganizations();
  }

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider<OrganizationService>.value(
      value: service,
      child: Consumer<OrganizationService>(
        builder: (context, svc, _) {
          if (svc.isLoading)
            return const Center(child: CircularProgressIndicator());
          if (svc.error != null)
            return Center(child: Text('Error: ${svc.error}'));

          final permitted = auth.hasPermission('organization.read');

          if (!permitted)
            return Center(
              child: Text('You do not have permission to view organizations.'),
            );

          final items = svc.organizations;
          return Scaffold(
            appBar: AppBar(title: const Text('Organizations')),
            body: Column(
              children: [
                ErpPageHeader(
                  title: 'Organizations',
                  subtitle: 'Manage organizations in the ERP',
                  breadcrumbs: const [
                    ErpBreadcrumbItem(label: 'Dashboard', route: '/dashboard'),
                    ErpBreadcrumbItem(label: 'Organizations'),
                  ],
                ),
                Expanded(
                  child: RefreshIndicator(
                    onRefresh: () => svc.fetchOrganizations(),
                    child: items.isEmpty
                        ? ListView(
                            children: [
                              Center(
                                child: Padding(
                                  padding: EdgeInsets.all(24),
                                  child: Text('No organizations found.'),
                                ),
                              ),
                            ],
                          )
                        : ListView.builder(
                            itemCount: items.length,
                            itemBuilder: (context, index) {
                              final org = items[index];
                              return ListTile(
                                title: Text(
                                  org['name'] ?? org['code'] ?? 'Unnamed',
                                ),
                                subtitle: Text(org['legalName'] ?? ''),
                                onTap: () => Navigator.of(context).pushNamed(
                                  '/organizations/details',
                                  arguments: org['id'],
                                ),
                              );
                            },
                          ),
                  ),
                ),
              ],
            ),
            floatingActionButton: auth.hasPermission('organization.manage')
                ? FloatingActionButton(
                    onPressed: () =>
                        Navigator.of(context)
                            .pushNamed('/organizations/create'),
                    child: Icon(Icons.add),
                  )
                : null,
          );
        },
      ),
    );
  }
}
