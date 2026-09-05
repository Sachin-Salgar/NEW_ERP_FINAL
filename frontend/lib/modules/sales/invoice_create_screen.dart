import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import 'sales_service.dart';

class CreateSalesInvoiceScreen extends StatefulWidget {
  const CreateSalesInvoiceScreen({super.key});
  @override
  State<CreateSalesInvoiceScreen> createState() =>
      _CreateSalesInvoiceScreenState();
}

class _CreateSalesInvoiceScreenState extends State<CreateSalesInvoiceScreen> {
  final deliveryController = TextEditingController();
  final keyController = TextEditingController();
  late final SalesService service;
  bool saving = false;

  @override
  void initState() {
    super.initState();
    service = GetIt.instance.get<SalesService>();
  }

  @override
  void dispose() {
    deliveryController.dispose();
    keyController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() => saving = true);
    final error = await service.createInvoice({
      'deliveryId': deliveryController.text.trim(),
      'idempotencyKey': keyController.text.trim(),
    });
    if (!mounted) return;
    setState(() => saving = false);
    if (error != null) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(error)));
      return;
    }
    Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Create Sales Invoice')),
    body: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          TextField(
            controller: deliveryController,
            decoration: const InputDecoration(
              labelText: 'Completed delivery ID',
            ),
          ),
          TextField(
            controller: keyController,
            decoration: const InputDecoration(labelText: 'Idempotency key'),
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: saving ? null : _save,
            child: Text(saving ? 'Creating...' : 'Create invoice'),
          ),
        ],
      ),
    ),
  );
}
