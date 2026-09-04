import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import '../../core/auth/auth_service.dart';
import 'customer_service.dart';

class EditCustomerScreen extends StatefulWidget {
  final String id;
  const EditCustomerScreen({super.key, required this.id});
  @override
  State<EditCustomerScreen> createState() => _EditCustomerScreenState();
}

class _EditCustomerScreenState extends State<EditCustomerScreen> {
  final formKey = GlobalKey<FormState>();
  final nameController = TextEditingController();
  late final CustomerService service;
  late final AuthService auth;
  bool loading = true;
  bool submitting = false;
  String? error;

  @override
  void initState() {
    super.initState();
    service = GetIt.instance.get<CustomerService>();
    auth = GetIt.instance.get<AuthService>();
    load();
  }

  @override
  void dispose() { nameController.dispose(); super.dispose(); }

  Future<void> load() async {
    final result = await service.getCustomer(widget.id);
    if (!mounted) return;
    if (result == null) {
      setState(() { loading = false; error = service.error ?? 'Customer not found.'; });
    } else {
      nameController.text = result['name'] as String? ?? '';
      setState(() => loading = false);
    }
  }

  Future<void> submit() async {
    if (!formKey.currentState!.validate() || submitting) return;
    setState(() { submitting = true; error = null; });
    final updated = await service.updateCustomer(widget.id, nameController.text);
    if (!mounted) return;
    if (updated != null) {
      Navigator.pop(context, updated);
    } else {
      setState(() {
        submitting = false;
        error = service.error ?? 'Failed to update customer.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (loading) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    if (!auth.hasPermission('customer.update')) {
      return const Scaffold(body: Center(child: Text('You do not have permission to edit customers.')));
    }
    return Scaffold(
      appBar: AppBar(title: const Text('Edit Customer')),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 760),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Form(
              key: formKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextFormField(
                    controller: nameController,
                    decoration: const InputDecoration(labelText: 'Name'),
                    validator: (value) => value == null || value.trim().isEmpty ? 'Name is required.' : null,
                  ),
                  if (error != null) ...[
                    const SizedBox(height: 12),
                    Text(error!, style: const TextStyle(color: Colors.red)),
                  ],
                  const SizedBox(height: 24),
                  Align(
                    alignment: Alignment.centerRight,
                    child: FilledButton.icon(
                      onPressed: submitting ? null : submit,
                      icon: submitting
                          ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                          : const Icon(Icons.save_outlined),
                      label: const Text('Save changes'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
