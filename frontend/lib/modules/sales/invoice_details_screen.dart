import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import 'sales_service.dart';
import '../../core/auth/auth_service.dart';

class SalesInvoiceDetailsScreen extends StatefulWidget {
  final String id;
  const SalesInvoiceDetailsScreen({required this.id, super.key});
  @override
  State<SalesInvoiceDetailsScreen> createState() =>
      _SalesInvoiceDetailsScreenState();
}

class _SalesInvoiceDetailsScreenState extends State<SalesInvoiceDetailsScreen> {
  late final SalesService service;
  late final AuthService auth;
  Map<String, dynamic>? invoice;
  String? error;

  @override
  void initState() {
    super.initState();
    service = GetIt.instance.get<SalesService>();
    auth = GetIt.instance.get<AuthService>();
    _load();
  }

  Future<void> _transition(String action) async {
    final result = await service.transitionInvoice(
      widget.id,
      action,
      (invoice?['versionNumber'] as num?)?.toInt() ?? 0,
    );
    if (!mounted) return;
    if (result == null) {
      await _load();
    } else {
      setState(() => error = result);
    }
  }

  Future<void> _load() async {
    final value = await service.getInvoice(widget.id);
    if (!mounted) return;
    setState(() {
      invoice = value;
      error = value == null ? service.error : null;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (error != null)
      return Scaffold(
        appBar: AppBar(title: const Text('Invoice')),
        body: Center(child: Text(error!)),
      );
    if (invoice == null)
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    final current = invoice!;
    final status = '${current['status'] ?? ''}';
    return Scaffold(
      appBar: AppBar(title: Text('${current['invoiceNumber'] ?? 'Invoice'}')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Status: $status'),
          Text('Delivery: ${current['deliveryId'] ?? ''}'),
          Text('Finance: ${current['financeStatus'] ?? 'NOT_CONNECTED'}'),
          Text('Tax: ${current['taxStatus'] ?? 'NOT_CONNECTED'}'),
          if (status == 'DRAFT' && auth.hasPermission('sales.invoice.issue'))
           FilledButton(onPressed: () => _transition('issue'), child: const Text('Issue')),
          if (status == 'DRAFT' && auth.hasPermission('sales.invoice.cancel'))
           OutlinedButton(onPressed: () => _transition('cancel'), child: const Text('Cancel')),
          const SizedBox(height: 16),
          ...(current['items'] as List<dynamic>? ?? const []).map((item) {
            final line = Map<String, dynamic>.from(item as Map);
            return ListTile(
              title: Text('${line['description'] ?? ''}'),
              subtitle: Text(
                '${line['quantity'] ?? ''} ${line['unitOfMeasure'] ?? ''}',
              ),
              trailing: Text('${line['lineTotal'] ?? ''}'),
            );
          }),
        ],
      ),
    );
  }
}
