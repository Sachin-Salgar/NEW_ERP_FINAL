import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import '../../core/auth/auth_service.dart';
import 'customer_service.dart';

class CreateCustomerScreen extends StatefulWidget {
  const CreateCustomerScreen({super.key});
  @override
  State<CreateCustomerScreen> createState() => _CreateCustomerScreenState();
}

class _CreateCustomerScreenState extends State<CreateCustomerScreen> {
  final formKey = GlobalKey<FormState>();
  final nameController = TextEditingController();
  late final CustomerService service;
  late final AuthService auth;
  bool submitting = false;
  String? error;

  @override
  void initState() {
    super.initState();
    service = GetIt.instance.get<CustomerService>();
    auth = GetIt.instance.get<AuthService>();
  }

  @override
  void dispose() {
    nameController.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    if (!formKey.currentState!.validate() || submitting) return;
    setState(() { submitting = true; error = null; });
    final result = await service.createCustomer(nameController.text);
    if (!mounted) return;
    setState(() { submitting = false; error = result; });
    if (result == null) Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    if (!auth.hasPermission('customer.create')) {
      return const Scaffold(body: Center(child: Text('You do not have permission to create customers.')));
    }
    return Scaffold(
      appBar: AppBar(title: const Text('Create Customer')),
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
                    autofocus: true,
                    decoration: const InputDecoration(labelText: 'Name'),
                    validator: (value) => value == null || value.trim().isEmpty
                        ? 'Name is required.'
                        : null,
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
                          : const Icon(Icons.add),
                      label: const Text('Create customer'),
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
