import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import 'sales_service.dart';

class SalesBoundaryCreateScreen extends StatefulWidget {
  final String kind;
  final String sourceLabel;
  final String title;
  final String? initialSourceId;
  const SalesBoundaryCreateScreen({
    super.key,
    required this.kind,
    required this.sourceLabel,
    required this.title,
    this.initialSourceId,
  });
  @override
  State<SalesBoundaryCreateScreen> createState() =>
      _SalesBoundaryCreateScreenState();
}

class _SalesBoundaryCreateScreenState extends State<SalesBoundaryCreateScreen> {
  final source = TextEditingController();
  final idempotency = TextEditingController();
  final notes = TextEditingController();
  late final SalesService service = GetIt.instance.get<SalesService>();
  bool saving = false;
  String? error;

  @override
  void initState() {
    super.initState();
    source.text = widget.initialSourceId ?? '';
  }

  @override
  void dispose() {
    source.dispose();
    idempotency.dispose();
    notes.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      saving = true;
      error = null;
    });
    final sourceKey = widget.kind == 'returns'
        ? 'invoiceId'
        : widget.kind == 'deliveries'
        ? 'salesOrderId'
        : 'returnId';
    final result = await service.createBoundary(widget.kind, {
      sourceKey: source.text.trim(),
      'idempotencyKey': idempotency.text.trim(),
      'notes': notes.text.trim().isEmpty ? null : notes.text.trim(),
    });
    if (!mounted) return;
    setState(() {
      saving = false;
      error = result;
    });
    if (result == null) Navigator.pop(context, true);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(widget.title)),
    body: ListView(
      padding: const EdgeInsets.all(16),
      children: [
        TextField(
          controller: source,
          decoration: InputDecoration(labelText: widget.sourceLabel),
        ),
        TextField(
          controller: idempotency,
          decoration: const InputDecoration(labelText: 'Idempotency key'),
        ),
        TextField(
          controller: notes,
          decoration: const InputDecoration(labelText: 'Notes'),
        ),
        if (error != null)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Text(
              error!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ),
        const SizedBox(height: 16),
        FilledButton(
          onPressed: saving ? null : _submit,
          child: saving
              ? const CircularProgressIndicator()
              : const Text('Create'),
        ),
      ],
    ),
  );
}
