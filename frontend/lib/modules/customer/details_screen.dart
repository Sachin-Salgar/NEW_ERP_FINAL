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
                final updated = await Navigator.pushNamed<Map<String, dynamic>>(
                  context,
                  '/customers/${widget.id}/edit',
                );
                if (updated != null && mounted) {
                  setState(() => customer = updated);
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
            child: ListTile(
              title: const Text('Customer name'),
              subtitle: Text(customer!['name'] as String),
            ),
          ),
        ),
      ),
    );
  }
}
