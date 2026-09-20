import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'package:provider/provider.dart';

import '../../presentation/ui/components/page_header.dart';
import 'inventory_service.dart';

class InventoryFoundationScreen extends StatefulWidget {
  const InventoryFoundationScreen({super.key});

  @override
  State<InventoryFoundationScreen> createState() => _InventoryFoundationScreenState();
}

class _InventoryFoundationScreenState extends State<InventoryFoundationScreen> {
  late final InventoryService service;

  @override
  void initState() {
    super.initState();
    service = GetIt.instance.get<InventoryService>();
    WidgetsBinding.instance.addPostFrameCallback((_) => service.refresh());
  }

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider<InventoryService>.value(
      value: service,
      child: Consumer<InventoryService>(
        builder: (context, inventory, _) {
          return Scaffold(
            body: RefreshIndicator(
              onRefresh: inventory.refresh,
              child: CustomScrollView(
                slivers: [
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(24, 24, 24, 16),
                    sliver: SliverToBoxAdapter(
                      child: ErpPageHeader(
                        title: 'Inventory Foundation',
                        subtitle: 'Warehouses, stock balances, and reservations',
                        breadcrumbs: const [ErpBreadcrumbItem(label: 'Dashboard'), ErpBreadcrumbItem(label: 'Inventory')],
                        actions: [
                          FilledButton.icon(
                            onPressed: () => _createWarehouse(context),
                            icon: const Icon(Icons.add),
                            label: const Text('Add Warehouse'),
                          ),
                        ],
                      ),
                    ),
                  ),
                  if (inventory.loading && inventory.warehouses.isEmpty)
                    const SliverFillRemaining(hasScrollBody: false, child: Center(child: CircularProgressIndicator()))
                  else if (inventory.error != null)
                    SliverFillRemaining(hasScrollBody: false, child: Center(child: Text(inventory.error!)))
                  else
                    SliverPadding(
                      padding: const EdgeInsets.symmetric(horizontal: 24),
                      sliver: SliverToBoxAdapter(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _section('Warehouses', inventory.warehouses, const ['code', 'name', 'status']),
                            _section('Stock balances', inventory.stock, const ['warehouseId', 'itemId', 'onHandQuantity', 'reservedQuantity', 'availableQuantity']),
                            _section('Reservations', inventory.reservations, const ['sourceType', 'sourceId', 'quantity', 'status']),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _actionBar() {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        if (service.auth.hasPermission('inventory.warehouse.create'))
          FilledButton.icon(
            onPressed: _createWarehouse,
            icon: const Icon(Icons.warehouse_outlined),
            label: const Text('Add Warehouse'),
          ),
        if (service.auth.hasPermission('inventory.stock.receive'))
          OutlinedButton.icon(
            onPressed: _receiveStock,
            icon: const Icon(Icons.move_to_inbox_outlined),
            label: const Text('Receive Stock'),
          ),
        if (service.auth.hasPermission('inventory.reservation.create'))
          OutlinedButton.icon(
            onPressed: _createReservation,
            icon: const Icon(Icons.bookmark_add_outlined),
            label: const Text('Reserve Stock'),
          ),
        if (service.auth.hasPermission('inventory.stock.return'))
          OutlinedButton.icon(
            onPressed: _returnStock,
            icon: const Icon(Icons.keyboard_return_outlined),
            label: const Text('Return Stock'),
          ),
      ],
    );
  }

  Widget _section(
    String title,
    List<Map<String, dynamic>> rows,
    List<String> fields,
  ) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 24),
      child: Card(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                '\$title (${rows.length})',
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ),
            if (rows.isEmpty)
              const Padding(
                padding: EdgeInsets.all(16),
                child: Text('No records found.'),
              )
            else
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: DataTable(
                  columns: fields
                      .map((field) => DataColumn(label: Text(field)))
                      .toList(),
                  rows: rows
                      .map(
                        (row) => DataRow(
                          cells: fields
                              .map(
                                (field) => DataCell(
                                  Text('${row[field] ?? ''}'),
                                ),
                              )
                              .toList(),
                        ),
                      )
                      .toList(),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _createWarehouse(BuildContext context) async {
    final code = TextEditingController();
    final name = TextEditingController();
    final result = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Add Warehouse'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(controller: code, decoration: const InputDecoration(labelText: 'Code')),
          TextField(controller: name, decoration: const InputDecoration(labelText: 'Name')),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('Cancel')),
          FilledButton(onPressed: () async { final error = await service.createWarehouse(code.text, name.text); if (dialogContext.mounted) { if (error == null) Navigator.pop(dialogContext, true); else ScaffoldMessenger.of(dialogContext).showSnackBar(SnackBar(content: Text(error))); } }, child: const Text('Save')),
        ],
      ),
    );
    code.dispose();
    name.dispose();
    if (result == true && context.mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Warehouse created.')));
  }
  Future<void> _receiveStock() async {
    final data = await _movementDialog('Receive Stock');
    if (data == null) return;
    final error = await service.receiveStock(data);
    _showResult(error, 'Stock received.');
  }

  Future<void> _createReservation() async {
    final data = await _movementDialog('Reserve Stock');
    if (data == null) return;
    data['idempotencyKey'] =
        'ui-${DateTime.now().microsecondsSinceEpoch}';
    final error = await service.createReservation(data);
    _showResult(error, 'Stock reserved.');
  }

  Future<void> _returnStock() async {
    final data = await _movementDialog('Return Stock');
    if (data == null) return;
    data['idempotencyKey'] =
        'ui-${DateTime.now().microsecondsSinceEpoch}';
    final error = await service.returnStock(data);
    _showResult(error, 'Stock returned.');
  }

  Future<Map<String, dynamic>?> _movementDialog(String title) async {
    final warehouse = TextEditingController();
    final item = TextEditingController();
    final quantity = TextEditingController();
    final sourceType = TextEditingController(text: 'MANUAL');
    final sourceId = TextEditingController();

    final result = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(title),
        content: SingleChildScrollView(
          child: Column(
            children: [
              _field(warehouse, 'Warehouse ID'),
              _field(item, 'Item ID'),
              _field(
                quantity,
                'Quantity',
                keyboardType: TextInputType.number,
              ),
              _field(sourceType, 'Source Type'),
              _field(sourceId, 'Source ID'),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              if (warehouse.text.isEmpty ||
                  item.text.isEmpty ||
                  quantity.text.isEmpty ||
                  sourceId.text.isEmpty) {
                return;
              }
              Navigator.pop(dialogContext, {
                'warehouseId': warehouse.text.trim(),
                'itemId': item.text.trim(),
                'quantity': double.tryParse(quantity.text) ?? 0,
                'sourceType': sourceType.text.trim(),
                'sourceId': sourceId.text.trim(),
              });
            },
            child: const Text('Submit'),
          ),
        ],
      ),
    );

    for (final controller in [
      warehouse,
      item,
      quantity,
      sourceType,
      sourceId,
    ]) {
      controller.dispose();
    }
    return result;
  }

  void _showResult(String? error, String success) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(error ?? success)),
    );
  }

  Widget _field(
    TextEditingController controller,
    String label, {
    TextInputType? keyboardType,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: TextField(
        controller: controller,
        keyboardType: keyboardType,
        decoration: InputDecoration(
          labelText: label,
          border: const OutlineInputBorder(),
        ),
      ),
    );
  }

}
