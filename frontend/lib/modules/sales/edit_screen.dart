import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import '../../core/auth/auth_service.dart';
import '../customer/customer_service.dart';
import 'sales_service.dart';

class EditSalesQuotationScreen extends StatefulWidget {
  final String id;
  const EditSalesQuotationScreen({super.key, required this.id});
  @override
  State<EditSalesQuotationScreen> createState() =>
      _EditSalesQuotationScreenState();
}

class _EditSalesQuotationScreenState extends State<EditSalesQuotationScreen> {
  late final SalesService service;
  late final CustomerService customerService;
  late final AuthService auth;
  final dateController = TextEditingController();
  final validUntilController = TextEditingController();
  final notesController = TextEditingController();
  String? customerId;
  String? error;
  bool loading = true;
  bool saving = false;
  List<Map<String, dynamic>> customers = [];
  Map<String, dynamic>? quotation;
  List<Map<String, dynamic>> items = [];

  @override
  void initState() {
    super.initState();
    service = GetIt.instance.get<SalesService>();
    customerService = GetIt.instance.get<CustomerService>();
    auth = GetIt.instance.get<AuthService>();
    _load();
  }

  Future<void> _load() async {
    final result = await service.getQuotation(widget.id);
    await customerService.fetchCustomers();
    if (!mounted) return;
    setState(() {
      quotation = result;
      customers = customerService.customers;
      customerId =
          result?['customerId'] as String? ?? result?['customer_id'] as String?;
      dateController.text =
          '${result?['quotationDate'] ?? result?['quotation_date'] ?? ''}'
              .substring(0, 10);
      validUntilController.text =
          '${result?['validUntil'] ?? result?['valid_until'] ?? ''}'.substring(
            0,
            10,
          );
      notesController.text = '${result?['notes'] ?? ''}';
      items = ((result?['items'] as List<dynamic>?) ?? const [])
          .map((item) => Map<String, dynamic>.from(item as Map))
          .toList();
      loading = false;
      error = result == null ? service.error : null;
    });
  }

  @override
  void dispose() {
    dateController.dispose();
    validUntilController.dispose();
    notesController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() => saving = true);
    final result = await service.updateQuotation(widget.id, {
      'customerId': customerId,
      'quotationDate': dateController.text,
      'validUntil': validUntilController.text,
      'notes': notesController.text.trim().isEmpty
          ? null
          : notesController.text.trim(),
      'items': items
          .map(
            (item) => {
              'lineNumber': item['lineNumber'] ?? item['line_number'],
              'description': item['description'],
              'quantity': item['quantity'],
              'unitPrice': item['unitPrice'] ?? item['unit_price'],
              'unitOfMeasure': item['unitOfMeasure'] ?? item['unit_of_measure'],
            },
          )
          .toList(),
    });
    if (!mounted) return;
    if (result == null)
      Navigator.pop(context);
    else
      setState(() {
        saving = false;
        error = result;
      });
  }

  @override
  Widget build(BuildContext context) {
    if (!auth.hasPermission('sales.quotation.update'))
      return const Scaffold(
        body: Center(
          child: Text('You do not have permission to edit quotations.'),
        ),
      );
    if (loading)
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    if (quotation == null)
      return Scaffold(
        body: Center(child: Text(error ?? 'Quotation not found.')),
      );
    return Scaffold(
      appBar: AppBar(title: const Text('Edit Sales Quotation')),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          DropdownButtonFormField<String>(
            initialValue:
                customers.any((customer) => customer['id'] == customerId)
                ? customerId
                : null,
            items: customers
                .map(
                  (customer) => DropdownMenuItem(
                    value: customer['id'] as String,
                    child: Text(customer['name'] as String),
                  ),
                )
                .toList(),
            onChanged: (value) => setState(() => customerId = value),
            decoration: const InputDecoration(labelText: 'Customer'),
          ),
          TextField(
            controller: dateController,
            decoration: const InputDecoration(labelText: 'Quotation date'),
          ),
          TextField(
            controller: validUntilController,
            decoration: const InputDecoration(labelText: 'Valid until'),
          ),
          TextField(
            controller: notesController,
            decoration: const InputDecoration(labelText: 'Notes'),
          ),
          if (error != null)
            Text(error!, style: const TextStyle(color: Colors.red)),
          const SizedBox(height: 20),
          FilledButton(
            onPressed: saving ? null : _save,
            child: Text(saving ? 'Saving...' : 'Save changes'),
          ),
        ],
      ),
    );
  }
}
