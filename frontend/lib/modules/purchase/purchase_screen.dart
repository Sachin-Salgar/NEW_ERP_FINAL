import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_service.dart';
import '../../presentation/ui/components/page_header.dart';
import 'purchase_service.dart';

class PurchaseScreen extends StatefulWidget {
  const PurchaseScreen({super.key});

  @override
  State<PurchaseScreen> createState() => _PurchaseScreenState();
}

class _PurchaseScreenState extends State<PurchaseScreen> {
  late final PurchaseService service;
  late final AuthService auth;

  @override
  void initState() {
    super.initState();
    service = GetIt.instance.get<PurchaseService>();
    auth = GetIt.instance.get<AuthService>();
    WidgetsBinding.instance.addPostFrameCallback((_) => service.load());
  }

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider<PurchaseService>.value(
      value: service,
      child: Consumer<PurchaseService>(
        builder: (context, purchase, _) {
          if (!auth.hasPermission('purchase.supplier.read')) {
            return const Center(child: Text('You do not have permission to view Purchase.'));
          }
          return Scaffold(
            body: RefreshIndicator(
              onRefresh: purchase.load,
              child: CustomScrollView(
                slivers: [
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(24, 24, 24, 0),
                    sliver: SliverToBoxAdapter(
                      child: ErpPageHeader(
                        title: 'Purchase',
                        subtitle: 'Manage suppliers and procurement documents',
                        breadcrumbs: const [
                          ErpBreadcrumbItem(label: 'Dashboard'),
                          ErpBreadcrumbItem(label: 'Purchase'),
                        ],
                        actions: auth.hasPermission('purchase.supplier.create')
                            ? [
                                FilledButton.icon(
                                  onPressed: () => _showSupplierDialog(context),
                                  icon: const Icon(Icons.add),
                                  label: const Text('Add Supplier'),
                                ),
                              ]
                            : null,
                      ),
                    ),
                  ),
                  if (purchase.error != null)
                    SliverFillRemaining(
                      hasScrollBody: false,
                      child: Center(child: Text(purchase.error!)),
                    )
                  else if (purchase.isLoading && purchase.suppliers.isEmpty)
                    const SliverFillRemaining(
                      hasScrollBody: false,
                      child: Center(child: CircularProgressIndicator()),
                    )
                  else
                    SliverPadding(
                      padding: const EdgeInsets.all(24),
                      sliver: SliverList(
                        delegate: SliverChildListDelegate([
                          _SummaryCard(
                            title: 'Suppliers',
                            icon: Icons.business_outlined,
                            count: purchase.suppliers.length,
                            children: purchase.suppliers
                                .map((item) => ListTile(
                                      title: Text('${item['name'] ?? ''}'),
                                      subtitle: Text('${item['code'] ?? ''}'),
                                    ))
                                .toList(),
                          ),
                          _SummaryCard(
                            title: 'Purchase Requisitions',
                            icon: Icons.assignment_outlined,
                            count: purchase.requisitions.length,
                            children: _documentTiles(purchase.requisitions),
                          ),
                          _SummaryCard(
                            title: 'Purchase Orders',
                            icon: Icons.shopping_cart_outlined,
                            count: purchase.orders.length,
                            children: _documentTiles(purchase.orders),
                          ),
                          _SummaryCard(
                            title: 'Purchase Receipts',
                            icon: Icons.inventory_2_outlined,
                            count: purchase.receipts.length,
                            children: _documentTiles(purchase.receipts),
                          ),
                        ]),
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

  List<Widget> _documentTiles(List<Map<String, dynamic>> documents) {
    return documents
        .map((item) => ListTile(
              title: Text('${item['documentNumber'] ?? item['number'] ?? item['id'] ?? ''}'),
              subtitle: Text('${item['status'] ?? ''}'),
            ))
        .toList();
  }

  Future<void> _showSupplierDialog(BuildContext context) async {
    final code = TextEditingController();
    final name = TextEditingController();
    final email = TextEditingController();
    final phone = TextEditingController();
    final formKey = GlobalKey<FormState>();
    await showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Add Supplier'),
        content: Form(
          key: formKey,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextFormField(controller: code, decoration: const InputDecoration(labelText: 'Supplier code'), validator: _required),
                TextFormField(controller: name, decoration: const InputDecoration(labelText: 'Supplier name'), validator: _required),
                TextFormField(controller: email, decoration: const InputDecoration(labelText: 'Email')),
                TextFormField(controller: phone, decoration: const InputDecoration(labelText: 'Phone')),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('Cancel')),
          FilledButton(
            onPressed: () async {
              if (!formKey.currentState!.validate()) return;
              final error = await service.createSupplier(code: code.text, name: name.text, email: email.text, phone: phone.text);
              if (!dialogContext.mounted) return;
              if (error != null) {
                ScaffoldMessenger.of(dialogContext).showSnackBar(SnackBar(content: Text(error)));
              } else {
                Navigator.pop(dialogContext);
              }
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
    code.dispose();
    name.dispose();
    email.dispose();
    phone.dispose();
  }

  String? _required(String? value) => value == null || value.trim().isEmpty ? 'Required' : null;
}

class _SummaryCard extends StatelessWidget {
  final String title;
  final IconData icon;
  final int count;
  final List<Widget> children;

  const _SummaryCard({required this.title, required this.icon, required this.count, required this.children});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      child: ExpansionTile(
        leading: Icon(icon),
        title: Text(title),
        trailing: Text('$count'),
        children: children.isEmpty ? [const ListTile(title: Text('No records found.'))] : children,
      ),
    );
  }
}
