import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import '../../core/auth/auth_service.dart';
import '../inventory/inventory_service.dart';
import 'sales_service.dart';

class SalesQuotationDetailsScreen extends StatefulWidget {
  final String id;
  const SalesQuotationDetailsScreen({super.key, required this.id});
  @override
  State<SalesQuotationDetailsScreen> createState() => _SalesQuotationDetailsScreenState();
}

class _SalesQuotationDetailsScreenState extends State<SalesQuotationDetailsScreen> {
  late final SalesService service;
  late final AuthService auth;
  late final InventoryService inventory;
  Map<String, dynamic>? quotation;
  String? error;

  @override
  void initState() {
    super.initState();
    service = GetIt.instance.get<SalesService>();
    auth = GetIt.instance.get<AuthService>();
    inventory = GetIt.instance.get<InventoryService>();
    _load();
  }

  Future<void> _load() async {
    final result = await service.getQuotation(widget.id);
    if (mounted) setState(() { quotation = result; error = result == null ? service.error : null; });
  }

  Future<void> _transition(String action) async {
    final result = await service.transition(widget.id, action);
    if (!mounted) return;
    if (result == null) _load(); else setState(() => error = result);
  }

  Future<void> _convertToOrder() async {
    await inventory.refresh();
    if (!mounted) return;
    if (inventory.error != null || inventory.warehouses.isEmpty) {
      setState(() => error = inventory.error ?? 'An active Inventory warehouse is required.');
      return;
    }
    final warehouseId = await showDialog<String>(
      context: context,
      builder: (context) => SimpleDialog(
        title: const Text('Select warehouse'),
        children: inventory.warehouses
            .where((warehouse) => '${warehouse['status']}'.toUpperCase() == 'ACTIVE')
            .map((warehouse) => SimpleDialogOption(
                  onPressed: () => Navigator.pop(context, '${warehouse['id']}'),
                  child: Text('${warehouse['name']}'),
                ))
            .toList(),
      ),
    );
    if (warehouseId == null) return;
    final result = await service.convertQuotationToOrder(widget.id, warehouseId);
    if (mounted && result != null) setState(() => error = result);
    if (mounted && result == null) Navigator.pushNamed(context, '/sales/orders');
  }

  @override
  Widget build(BuildContext context) {
    if (quotation == null) {
      return Scaffold(body: Center(child: error == null ? const CircularProgressIndicator() : Text(error!)));
    }
    final status = '${quotation!['status']}';
    final canEdit = status == 'DRAFT' && auth.hasPermission('sales.quotation.update');
    final actions = <String, String>{
      if (status == 'DRAFT' && auth.hasPermission('sales.quotation.send')) 'send': 'Send',
      if (status == 'DRAFT' && auth.hasPermission('sales.quotation.cancel')) 'cancel': 'Cancel',
      if (status == 'SENT' && auth.hasPermission('sales.quotation.accept')) 'accept': 'Accept',
      if (status == 'SENT' && auth.hasPermission('sales.quotation.reject')) 'reject': 'Reject',
      if (status == 'SENT' && auth.hasPermission('sales.quotation.expire')) 'expire': 'Expire',
      if (status == 'SENT' && auth.hasPermission('sales.quotation.cancel')) 'cancel': 'Cancel',
    };
    if (status == 'ACCEPTED' && auth.hasPermission('sales.order.create')) {
      actions['convert'] = 'Convert to order';
    }
    final items = (quotation!['items'] as List<dynamic>?) ?? const [];
    return Scaffold(
      appBar: AppBar(
        title: Text('${quotation!['quotationNumber'] ?? quotation!['quotation_number']}'),
        actions: [
          if (canEdit) IconButton(onPressed: () => Navigator.pushNamed(context, '/sales/quotations/${widget.id}/edit'), icon: const Icon(Icons.edit)),
          if (auth.hasPermission('sales.quotation.delete') && status == 'DRAFT')
            IconButton(onPressed: () async { final result = await service.deleteQuotation(widget.id); if (result == null && mounted) Navigator.pop(context); }, icon: const Icon(Icons.delete)),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Text('Status: $status', style: Theme.of(context).textTheme.titleMedium),
          Text('Customer: ${quotation!['customerName'] ?? quotation!['customer_name'] ?? quotation!['customerId'] ?? quotation!['customer_id']}'),
          Text('Quotation date: ${quotation!['quotationDate'] ?? quotation!['quotation_date']}'),
          Text('Valid until: ${quotation!['validUntil'] ?? quotation!['valid_until']}'),
          if ((quotation!['notes'] ?? '').toString().isNotEmpty) Text('Notes: ${quotation!['notes']}'),
          const SizedBox(height: 16),
          ...items.map((item) => ListTile(
            title: Text('${item['description']}'),
            subtitle: Text('${item['quantity']} ${item['unitOfMeasure'] ?? item['unit_of_measure']} @ ${item['unitPrice'] ?? item['unit_price']}'),
          )),
          if (actions.isNotEmpty) Wrap(spacing: 8, children: actions.entries.map((entry) => FilledButton(onPressed: () async {
            if (entry.key == 'convert') {
              await _convertToOrder();
            } else {
              _transition(entry.key);
            }
          }, child: Text(entry.value))).toList()),
          if (error != null) Text(error!, style: const TextStyle(color: Colors.red)),
        ],
      ),
    );
  }
}
