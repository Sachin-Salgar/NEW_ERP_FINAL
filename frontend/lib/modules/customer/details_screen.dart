import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import '../../core/auth/auth_service.dart';
import 'customer_service.dart';

class CustomerDetailsScreen extends StatefulWidget {
  final String id;
  const CustomerDetailsScreen({super.key, required this.id});
  @override
  State<CustomerDetailsScreen> createState() => _CustomerDetailsScreenState();
}

class _CustomerDetailsScreenState extends State<CustomerDetailsScreen> {
  late final CustomerService service;
  late final AuthService auth;
  Map<String, dynamic>? customer;
  String? error;
  bool loading = true;
  bool deleting = false;

  @override
  void initState() {
    super.initState();
    service = GetIt.instance.get<CustomerService>();
    auth = GetIt.instance.get<AuthService>();
    load();
  }

  Future<void> load() async {
    final result = await service.getCustomer(widget.id);
    if (!mounted) return;
    setState(() { customer = result; loading = false; error = result == null ? (service.error ?? 'Customer not found.') : null; });
  }

  Future<void> remove() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete customer?'),
        content: const Text('This customer will be removed from active lists.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Delete')),
        ],
      ),
    );
    if (confirmed != true || deleting) return;
    setState(() => deleting = true);
    final result = await service.deleteCustomer(widget.id);
    if (!mounted) return;
    if (result == null) {
      Navigator.pushNamedAndRemoveUntil(context, '/customers', (_) => false);
    } else {
      setState(() { deleting = false; error = result; });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (loading) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    if (customer == null) return Scaffold(body: Center(child: Text(error ?? 'Customer not found.')));
    final canEdit = auth.hasPermission('customer.update');
    final canDelete = auth.hasPermission('customer.delete');
    return Scaffold(
      appBar: AppBar(
        title: Text(customer!['name'] as String),
        actions: [
          if (canEdit)
            IconButton(
              tooltip: 'Edit customer',
              onPressed: () async {
                final updated = await Navigator.pushNamed<dynamic>(
                  context,
                  '/customers/${widget.id}/edit',
                );
                if (updated != null && mounted) {
                  await load();
                }
              },
              icon: const Icon(Icons.edit_outlined),
            ),
          if (canDelete)
            IconButton(
              tooltip: 'Delete customer',
              onPressed: deleting ? null : remove,
              icon: const Icon(Icons.delete_outline),
            ),
        ],
      ),
      body: Center(
        child: Card(
          margin: const EdgeInsets.all(24),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(customer!['name'] as String, style: Theme.of(context).textTheme.headlineSmall),
                  const SizedBox(height: 16),
                  for (final entry in customer!.entries)
                    if (!['contacts', 'officeDetails', 'taxPaymentTerms', 'otherDetails'].contains(entry.key))
                      if (entry.value != null && entry.value.toString().isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 4),
                          child: Text('${_label(entry.key)}: ${entry.value}'),
                        ),
                  _detail('Office Details', customer!['officeDetails']),
                  _detail('Tax & Payment Terms', customer!['taxPaymentTerms']),
                  _detail('Other Details', customer!['otherDetails']),
                  _contacts(customer!['contacts']),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  String _label(String value) => value.replaceAllMapped(RegExp(r'([A-Z])'), (match) => ' ${match.group(1)}');

  Widget _detail(String title, dynamic value) {
    if (value is! Map || value.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title, style: Theme.of(context).textTheme.titleMedium),
        for (final entry in value.entries)
          if (entry.value != null && entry.value.toString().isNotEmpty) Text('${_label(entry.key.toString())}: ${entry.value}'),
      ]),
    );
  }

  Widget _contacts(dynamic value) {
    if (value is! List || value.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Contact Persons', style: Theme.of(context).textTheme.titleMedium),
        for (final item in value)
          if (item is Map) Text(item.entries.map((entry) => '${_label(entry.key.toString())}: ${entry.value}').join(' | ')),
      ]),
    );
  }
}
