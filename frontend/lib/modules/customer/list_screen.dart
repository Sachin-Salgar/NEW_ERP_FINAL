import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_service.dart';
import '../../presentation/ui/components/page_header.dart';
import 'customer_service.dart';

class CustomerListScreen extends StatefulWidget {
  const CustomerListScreen({super.key});
  @override
  State<CustomerListScreen> createState() => _CustomerListScreenState();
}

class _CustomerListScreenState extends State<CustomerListScreen> {
  late final CustomerService service;
  late final AuthService auth;
  final searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    auth = GetIt.instance.get<AuthService>();
    service = GetIt.instance.get<CustomerService>();
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => service.fetchCustomers(),
    );
  }

  @override
  void dispose() {
    searchController.dispose();
    super.dispose();
  }

  void _search() =>
      service.fetchCustomers(search: searchController.text, page: 1);

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider<CustomerService>.value(
      value: service,
      child: Consumer<CustomerService>(
        builder: (context, svc, _) {
          if (svc.isLoading && svc.customers.isEmpty) {
            return const Center(child: CircularProgressIndicator());
          }
          if (!auth.hasPermission('customer.read')) {
            return const _Message(
              'You do not have permission to view customers.',
            );
          }
          return Scaffold(
            body: RefreshIndicator(
              onRefresh: () => svc.fetchCustomers(),
              child: CustomScrollView(
                slivers: [
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(24, 24, 24, 0),
                    sliver: SliverToBoxAdapter(
                      child: ErpPageHeader(
                        title: 'Customers',
                        subtitle: 'Manage customers in the CRM module',
                        breadcrumbs: const [
                          ErpBreadcrumbItem(label: 'Dashboard'),
                          ErpBreadcrumbItem(label: 'Customers'),
                        ],
                        actions: auth.hasPermission('customer.create')
                            ? [
                                FilledButton.icon(
                                  onPressed: () => Navigator.pushNamed(
                                    context,
                                    '/customers/create',
                                  ),
                                  icon: const Icon(Icons.add),
                                  label: const Text('Add Customer'),
                                ),
                              ]
                            : null,
                      ),
                    ),
                  ),
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(24, 16, 24, 0),
                    sliver: SliverToBoxAdapter(
                      child: TextField(
                        controller: searchController,
                        onSubmitted: (_) => _search(),
                        decoration: InputDecoration(
                          labelText: 'Search customers',
                          prefixIcon: const Icon(Icons.search),
                          suffixIcon: IconButton(
                            onPressed: _search,
                            icon: const Icon(Icons.arrow_forward),
                          ),
                        ),
                      ),
                    ),
                  ),
                  if (svc.error != null)
                    SliverFillRemaining(
                      hasScrollBody: false,
                      child: _Message(svc.error!),
                    )
                  else if (svc.customers.isEmpty)
                    const SliverFillRemaining(
                      hasScrollBody: false,
                      child: _Message('No customers found.'),
                    )
                  else
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(24, 16, 24, 8),
                      sliver: SliverToBoxAdapter(
                        child: Card(
                          clipBehavior: Clip.antiAlias,
                          child: LayoutBuilder(
                            builder: (context, constraints) {
                              if (constraints.maxWidth < 650) {
                                return Column(
                                  children: svc.customers
                                      .map(
                                        (customer) => ListTile(
                                          title: Text(
                                            customer['name'] as String,
                                          ),
                                          onTap: () => Navigator.pushNamed(
                                            context,
                                            '/customers/${customer['id']}',
                                          ),
                                          trailing: const Icon(
                                            Icons.chevron_right,
                                          ),
                                        ),
                                      )
                                      .toList(),
                                );
                              }
                              return DataTable(
                                columns: const [
                                  DataColumn(label: Text('Customer')),
                                  DataColumn(label: Text('')),
                                ],
                                rows: svc.customers
                                    .map(
                                      (customer) => DataRow(
                                        cells: [
                                          DataCell(
                                            Text(customer['name'] as String),
                                          ),
                                          DataCell(
                                            IconButton(
                                              onPressed: () => Navigator.pushNamed(
                                                context,
                                                '/customers/${customer['id']}',
                                              ),
                                              icon: const Icon(
                                                Icons.chevron_right,
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                    )
                                    .toList(),
                              );
                            },
                          ),
                        ),
                      ),
                    ),
                  if (svc.error == null && svc.customers.isNotEmpty)
                    SliverToBoxAdapter(
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          IconButton(
                            onPressed: svc.page > 1
                                ? () => svc.fetchCustomers(page: svc.page - 1)
                                : null,
                            icon: const Icon(Icons.chevron_left),
                          ),
                          Text('Page ${svc.page} of ${svc.totalPages}'),
                          IconButton(
                            onPressed: svc.page < svc.totalPages
                                ? () => svc.fetchCustomers(page: svc.page + 1)
                                : null,
                            icon: const Icon(Icons.chevron_right),
                          ),
                        ],
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

class _Message extends StatelessWidget {
  final String message;
  const _Message(this.message);
  @override
  Widget build(BuildContext context) => Center(
    child: Padding(padding: const EdgeInsets.all(32), child: Text(message)),
  );
}
