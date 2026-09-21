import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import '../../core/auth/auth_service.dart';
import 'customer_form.dart';
import 'customer_service.dart';

class EditCustomerScreen extends StatefulWidget {
  final String id;
  const EditCustomerScreen({super.key, required this.id});

  @override
  State<EditCustomerScreen> createState() => _EditCustomerScreenState();
}

class _EditCustomerScreenState extends State<EditCustomerScreen> {
  late final CustomerService service;
  late final AuthService auth;
  Map<String, dynamic>? customer;
  String? error;
  bool loading = true;

  @override
  void initState() {
    super.initState();
    service = GetIt.instance.get<CustomerService>();
    auth = GetIt.instance.get<AuthService>();
    _load();
  }

  Future<void> _load() async {
    final result = await service.getCustomer(widget.id);
    if (!mounted) return;
    setState(() {
      customer = result;
      error = result == null ? (service.error ?? 'Customer not found.') : null;
      loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (loading) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    if (!auth.hasPermission('customer.update')) {
      return const Scaffold(body: Center(child: Text('You do not have permission to edit customers.')));
    }
    if (customer == null) return Scaffold(body: Center(child: Text(error ?? 'Customer not found.')));
    return Scaffold(
      appBar: AppBar(title: const Text('Edit Customer')),
      body: CustomerForm(
        initial: customer,
        submitLabel: 'Save changes',
        onSubmit: (name, fields) async {
          fields['expectedVersion'] = customer!['version'];
          final updated = await service.updateCustomer(widget.id, name, fields: fields);
          return updated == null ? (service.error ?? 'Failed to update customer.') : null;
        },
      ),
    );
  }
}
