import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'sales_service.dart';

class SalesAdminCreateScreen extends StatefulWidget {
  final String kind;
  final String title;
  const SalesAdminCreateScreen({super.key, required this.kind, required this.title});
  @override State<SalesAdminCreateScreen> createState() => _SalesAdminCreateScreenState();
}

class _SalesAdminCreateScreenState extends State<SalesAdminCreateScreen> {
  final code = TextEditingController();
  final name = TextEditingController();
  final currency = TextEditingController(text: 'USD');
  final percentage = TextEditingController();
  final effectiveFrom = TextEditingController();
  String? error;
  bool saving = false;
  late final SalesService service = GetIt.instance.get<SalesService>();

  @override
  void dispose() { code.dispose(); name.dispose(); currency.dispose(); percentage.dispose(); effectiveFrom.dispose(); super.dispose(); }

  Future<void> _submit() async {
    setState(() { saving = true; error = null; });
    final input = widget.kind == 'price-lists'
        ? {'code': code.text.trim(), 'name': name.text.trim(), 'currency': currency.text.trim(), 'effectiveFrom': effectiveFrom.text.trim()}
        : {'code': code.text.trim(), 'name': name.text.trim(), 'percentage': double.tryParse(percentage.text), 'effectiveFrom': effectiveFrom.text.trim()};
    final result = await service.createSalesAdministration(widget.kind, input);
    if (!mounted) return;
    setState(() { saving = false; error = result; });
    if (result == null) Navigator.pop(context, true);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(widget.title)),
    body: ListView(
      padding: const EdgeInsets.all(16),
      children: [
        TextField(controller: code, decoration: const InputDecoration(labelText: 'Code')),
        TextField(controller: name, decoration: const InputDecoration(labelText: 'Name')),
        if (widget.kind == 'price-lists') TextField(controller: currency, decoration: const InputDecoration(labelText: 'Currency')),
        if (widget.kind == 'discount-rules') TextField(controller: percentage, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Percentage')),
        TextField(controller: effectiveFrom, decoration: const InputDecoration(labelText: 'Effective from (YYYY-MM-DD)')),
        if (error != null) Text(error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
        const SizedBox(height: 16),
        FilledButton(onPressed: saving ? null : _submit, child: saving ? const CircularProgressIndicator() : const Text('Create')),
      ],
    ),
  );
}
