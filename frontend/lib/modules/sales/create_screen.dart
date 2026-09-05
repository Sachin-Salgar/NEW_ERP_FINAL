import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import '../../core/auth/auth_service.dart';
import '../customer/customer_service.dart';
import 'sales_service.dart';

class CreateSalesQuotationScreen extends StatefulWidget {
  const CreateSalesQuotationScreen({super.key});
  @override
  State<CreateSalesQuotationScreen> createState() => _CreateSalesQuotationScreenState();
}

class _CreateSalesQuotationScreenState extends State<CreateSalesQuotationScreen> {
  final formKey = GlobalKey<FormState>();
  final dateController = TextEditingController();
  final validUntilController = TextEditingController();
  final notesController = TextEditingController();
  final descriptionController = TextEditingController();
  final quantityController = TextEditingController(text: '1');
  final unitPriceController = TextEditingController(text: '0');
  final unitController = TextEditingController(text: 'unit');
  late final SalesService service;
  late final CustomerService customerService;
  late final AuthService auth;
  List<Map<String, dynamic>> customers = [];
  String? customerId;
  String? error;
  bool submitting = false;

  @override
  void initState() {
    super.initState();
    service = GetIt.instance.get<SalesService>();
    customerService = GetIt.instance.get<CustomerService>();
    auth = GetIt.instance.get<AuthService>();
    final today = DateTime.now().toIso8601String().substring(0, 10);
    dateController.text = today;
    validUntilController.text = today;
    _loadCustomers();
  }

  Future<void> _loadCustomers() async {
    await customerService.fetchCustomers();
    if (mounted) setState(() => customers = customerService.customers);
  }

  @override
  void dispose() {
    for (final c in [dateController, validUntilController, notesController, descriptionController, quantityController, unitPriceController, unitController]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> submit() async {
    if (!formKey.currentState!.validate() || customerId == null || submitting) {
      if (customerId == null) setState(() => error = 'Customer is required.');
      return;
    }
    setState(() { submitting = true; error = null; });
    final result = await service.createQuotation({
      'customerId': customerId,
      'quotationDate': dateController.text,
      'validUntil': validUntilController.text,
      'notes': notesController.text.trim().isEmpty ? null : notesController.text.trim(),
      'items': [{
        'lineNumber': 1,
        'description': descriptionController.text.trim(),
        'quantity': num.parse(quantityController.text),
        'unitPrice': num.parse(unitPriceController.text),
        'unitOfMeasure': unitController.text.trim(),
      }],
    });
    if (!mounted) return;
    setState(() { submitting = false; error = result; });
    if (result == null) Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    if (!auth.hasPermission('sales.quotation.create')) {
      return const Scaffold(body: Center(child: Text('You do not have permission to create quotations.')));
    }
    return Scaffold(
      appBar: AppBar(title: const Text('Create Sales Quotation')),
      body: Form(
        key: formKey,
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            DropdownButtonFormField<String>(
              initialValue: customerId,
              decoration: const InputDecoration(labelText: 'Customer'),
              items: customers.map((customer) => DropdownMenuItem<String>(
                value: customer['id'] as String,
                child: Text(customer['name'] as String),
              )).toList(),
              onChanged: (value) => setState(() => customerId = value),
              validator: (_) => customerId == null ? 'Customer is required.' : null,
            ),
            TextFormField(controller: dateController, decoration: const InputDecoration(labelText: 'Quotation date'), validator: _required),
            TextFormField(controller: validUntilController, decoration: const InputDecoration(labelText: 'Valid until'), validator: _required),
            TextFormField(controller: notesController, decoration: const InputDecoration(labelText: 'Notes')),
            TextFormField(controller: descriptionController, decoration: const InputDecoration(labelText: 'Item description'), validator: _required),
            TextFormField(controller: quantityController, decoration: const InputDecoration(labelText: 'Quantity'), keyboardType: TextInputType.number, validator: _number),
            TextFormField(controller: unitPriceController, decoration: const InputDecoration(labelText: 'Unit price'), keyboardType: TextInputType.number, validator: _number),
            TextFormField(controller: unitController, decoration: const InputDecoration(labelText: 'Unit of measure'), validator: _required),
            if (error != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(error!, style: const TextStyle(color: Colors.red))),
            const SizedBox(height: 24),
            FilledButton(onPressed: submitting ? null : submit, child: Text(submitting ? 'Saving...' : 'Create quotation')),
          ],
        ),
      ),
    );
  }

  String? _required(String? value) => value == null || value.trim().isEmpty ? 'Required.' : null;
  String? _number(String? value) => value == null || num.tryParse(value) == null ? 'Enter a valid number.' : null;
}
