import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import '../../core/auth/auth_service.dart';
import 'sales_service.dart';

class SalesQuotationListScreen extends StatefulWidget {
  const SalesQuotationListScreen({super.key});
  @override
  State<SalesQuotationListScreen> createState() => _SalesQuotationListScreenState();
}

class _SalesQuotationListScreenState extends State<SalesQuotationListScreen> {
  late final SalesService service;
  late final AuthService auth;
  final searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    service = GetIt.instance.get<SalesService>();
    auth = GetIt.instance.get<AuthService>();
    service.fetchQuotations();
  }

  @override
  void dispose() {
    searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!auth.hasPermission('sales.quotation.read')) {
      return const Scaffold(body: Center(child: Text('You do not have permission to view quotations.')));
    }
    return Scaffold(
      appBar: AppBar(
        title: const Text('Sales Quotations'),
        actions: [
          if (auth.hasPermission('sales.quotation.create'))
            IconButton(
              tooltip: 'Create quotation',
              onPressed: () async {
                await Navigator.pushNamed(context, '/sales/quotations/create');
                if (mounted) service.fetchQuotations();
              },
              icon: const Icon(Icons.add),
            ),
        ],
      ),
      body: AnimatedBuilder(
        animation: service,
        builder: (context, _) {
          if (service.isLoading && service.quotations.isEmpty) {
            return const Center(child: CircularProgressIndicator());
          }
          if (service.error != null && service.quotations.isEmpty) {
            return Center(child: Text(service.error!));
          }
          return Column(
            children: [
              Padding(
                padding: const EdgeInsets.all(16),
                child: TextField(
                  controller: searchController,
                  decoration: InputDecoration(
                    labelText: 'Search quotations',
                    suffixIcon: IconButton(
                      icon: const Icon(Icons.search),
                      onPressed: () => service.fetchQuotations(search: searchController.text, page: 1),
                    ),
                  ),
                  onSubmitted: (value) => service.fetchQuotations(search: value, page: 1),
                ),
              ),
              Expanded(
                child: service.quotations.isEmpty
                    ? const Center(child: Text('No quotations found.'))
                    : ListView.builder(
                        itemCount: service.quotations.length,
                        itemBuilder: (context, index) {
                          final quotation = service.quotations[index];
                          return ListTile(
                            title: Text('${quotation['quotationNumber'] ?? quotation['quotation_number']}'),
                            subtitle: Text('${quotation['status'] ?? ''}  •  ${quotation['quotationDate'] ?? quotation['quotation_date'] ?? ''}'),
                            trailing: const Icon(Icons.chevron_right),
                            onTap: () => Navigator.pushNamed(
                              context,
                              '/sales/quotations/${quotation['id']}',
                            ),
                          );
                        },
                      ),
              ),
              if (service.totalPages > 1)
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    IconButton(
                      onPressed: service.page > 1 ? () => service.fetchQuotations(page: service.page - 1) : null,
                      icon: const Icon(Icons.chevron_left),
                    ),
                    Text('${service.page} / ${service.totalPages}'),
                    IconButton(
                      onPressed: service.page < service.totalPages ? () => service.fetchQuotations(page: service.page + 1) : null,
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
