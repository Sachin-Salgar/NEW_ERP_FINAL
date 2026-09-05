import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import '../../core/auth/auth_service.dart';
import 'sales_service.dart';

class SalesInvoiceListScreen extends StatefulWidget {
  const SalesInvoiceListScreen({super.key});
  @override
  State<SalesInvoiceListScreen> createState() => _SalesInvoiceListScreenState();
}

class _SalesInvoiceListScreenState extends State<SalesInvoiceListScreen> {
  late final SalesService service;
  late final AuthService auth;
  final searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    service = GetIt.instance.get<SalesService>();
    auth = GetIt.instance.get<AuthService>();
    service.fetchInvoices();
  }

  @override
  void dispose() {
    searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!auth.hasPermission('sales.invoice.read')) {
      return const Scaffold(
        body: Center(
          child: Text('You do not have permission to view invoices.'),
        ),
      );
    }
    return Scaffold(
      appBar: AppBar(title: const Text('Sales Invoices')),
      floatingActionButton: auth.hasPermission('sales.invoice.create')
          ? FloatingActionButton(
              onPressed: () async {
                await Navigator.pushNamed(context, '/sales/invoices/create');
                if (mounted) service.fetchInvoices();
              },
              child: const Icon(Icons.add),
            )
          : null,
      body: AnimatedBuilder(
        animation: service,
        builder: (context, _) {
          if (service.isLoading && service.invoices.isEmpty)
            return const Center(child: CircularProgressIndicator());
          if (service.error != null && service.invoices.isEmpty)
            return Center(child: Text(service.error!));
          return Column(
            children: [
              Padding(
                padding: const EdgeInsets.all(16),
                child: TextField(
                  controller: searchController,
                  decoration: InputDecoration(
                    labelText: 'Search invoices',
                    suffixIcon: IconButton(
                      icon: const Icon(Icons.search),
                      onPressed: () => service.fetchInvoices(
                        search: searchController.text,
                        page: 1,
                      ),
                    ),
                  ),
                  onSubmitted: (value) =>
                      service.fetchInvoices(search: value, page: 1),
                ),
              ),
              Expanded(
                child: service.invoices.isEmpty
                    ? const Center(child: Text('No invoices found.'))
                    : ListView.builder(
                        itemCount: service.invoices.length,
                        itemBuilder: (context, index) {
                          final invoice = service.invoices[index];
                          return ListTile(
                            title: Text('${invoice['invoiceNumber'] ?? ''}'),
                            subtitle: Text(
                              '${invoice['status'] ?? ''}  •  Finance: ${invoice['financeStatus'] ?? 'NOT_CONNECTED'}',
                            ),
                            onTap: () => Navigator.pushNamed(
                              context,
                              '/sales/invoices/${invoice['id']}',
                            ),
                          );
                        },
                      ),
              ),
              if (service.invoiceTotalPages > 1)
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    IconButton(
                      onPressed: service.invoicePage > 1
                          ? () => service.fetchInvoices(
                              page: service.invoicePage - 1,
                            )
                          : null,
                      icon: const Icon(Icons.chevron_left),
                    ),
                    Text(
                      '${service.invoicePage} / ${service.invoiceTotalPages}',
                    ),
                    IconButton(
                      onPressed: service.invoicePage < service.invoiceTotalPages
                          ? () => service.fetchInvoices(
                              page: service.invoicePage + 1,
                            )
                          : null,
                      icon: const Icon(Icons.chevron_right),
                    ),
                  ],
                ),
            ],
          );
        },
      ),
    );
  }
}
