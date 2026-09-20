import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'package:provider/provider.dart';

import '../../presentation/ui/components/page_header.dart';
import 'inventory_service.dart';

class InventoryFoundationScreen extends StatefulWidget {
  const InventoryFoundationScreen({super.key});

  @override
  State<InventoryFoundationScreen> createState() =>
      _InventoryFoundationScreenState();
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
                        subtitle:
                            'Warehouses, stock balances, and reservations',
                        breadcrumbs: const [
                          ErpBreadcrumbItem(label: 'Dashboard'),
                          ErpBreadcrumbItem(label: 'Inventory'),
                        ],
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
                    const SliverFillRemaining(
                      hasScrollBody: false,
                      child: Center(child: CircularProgressIndicator()),
                    )
                  else if (inventory.error != null)
                    SliverFillRemaining(
                      hasScrollBody: false,
                      child: Center(child: Text(inventory.error!)),
                    )
                  else
                    SliverPadding(
                      padding: const EdgeInsets.symmetric(horizontal: 24),
                      sliver: SliverToBoxAdapter(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _section('Warehouses', inventory.warehouses, const [
                              'code',
                              'name',
                              'status',
                              'version',
                            ], onRow: _editWarehouse),
                            _section('Stock balances', inventory.stock, const [
                              'warehouseId',
                              'itemId',
                              'onHandQuantity',
                              'reservedQuantity',
                              'availableQuantity',
                            ]),
                            _section(
                              'Reservations',
                              inventory.reservations,
                              const [
                                'sourceType',
                                'sourceId',
                                'quantity',
                                'status',
                              ],
                              onRow: _reservationActions,
                            ),
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

  Widget _section(
    String title,
    List<Map<String, dynamic>> rows,
    List<String> fields, {
    void Function(Map<String, dynamic>)? onRow,
  }) {
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
                  columns: [
                    ...fields.map((field) => DataColumn(label: Text(field))),
                    if (onRow != null) const DataColumn(label: Text('Actions')),
                  ],
                  rows: rows
                      .map(
                        (row) => DataRow(
                          cells: [
                            ...fields.map(
                              (field) => DataCell(Text('${row[field] ?? ''}')),
                            ),
                            if (onRow != null)
                              DataCell(
                                IconButton(
                                  onPressed: () => onRow(row),
                                  icon: const Icon(Icons.more_horiz),
                                ),
                              ),
                          ],
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
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: code,
              decoration: const InputDecoration(labelText: 'Code'),
            ),
            TextField(
              controller: name,
              decoration: const InputDecoration(labelText: 'Name'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () async {
              final error = await service.createWarehouse(code.text, name.text);
              if (dialogContext.mounted) {
                if (error == null)
                  Navigator.pop(dialogContext, true);
                else
                  ScaffoldMessenger.of(dialogContext)
                      .showSnackBar(SnackBar(content: Text(error)));
              }
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
    code.dispose();
    name.dispose();
    if (result == true && context.mounted)
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Warehouse created.')));
  }

  Future<void> _editWarehouse(Map<String, dynamic> row) async {
    if (!service.auth.hasPermission('inventory.warehouse.update')) return;
    final name = TextEditingController(text: '${row['name'] ?? ''}');
    var status = '${row['status'] ?? 'ACTIVE'}';
    final result = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Edit Warehouse'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: name,
                decoration: const InputDecoration(labelText: 'Name'),
              ),
              DropdownButtonFormField<String>(
                initialValue: status,
                decoration: const InputDecoration(labelText: 'Status'),
                items: const [
                  DropdownMenuItem(value: 'ACTIVE', child: Text('ACTIVE')),
                  DropdownMenuItem(value: 'INACTIVE', child: Text('INACTIVE')),
                ],
                onChanged: (value) {
                  if (value != null) setDialogState(() => status = value);
                },
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () async {
                final error = await service.updateWarehouse(
                  '${row['id']}',
                  name.text.trim(),
                  status,
                  (row['version'] as num?)?.toInt() ?? 1,
                );
                if (!dialogContext.mounted) return;
                if (error == null) {
                  Navigator.pop(dialogContext, true);
                } else {
                  ScaffoldMessenger.of(dialogContext)
                      .showSnackBar(SnackBar(content: Text(error)));
                }
              },
              child: const Text('Save'),
            ),
          ],
        ),
      ),
    );
    name.dispose();
    if (result == true && mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Warehouse updated.')));
    }
  }

  Future<void> _reservationActions(Map<String, dynamic> row) async {
    final actions = <String>[];
    if (service.auth.hasPermission('inventory.reservation.release') &&
        row['status'] == 'RESERVED') {
      actions.add('release');
    }
    if (service.auth.hasPermission('inventory.reservation.fulfill') &&
        row['status'] == 'RESERVED') {
      actions.add('fulfill');
    }
    if (actions.isEmpty) return;
    final selected = await showModalBottomSheet<String>(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (final action in actions)
              ListTile(
                title: Text(
                  action == 'release'
                      ? 'Release reservation'
                      : 'Fulfill reservation',
                ),
                onTap: () => Navigator.pop(context, action),
              ),
          ],
        ),
      ),
    );
    if (selected == null) return;
    final key = 'ui-${DateTime.now().microsecondsSinceEpoch}';
    final error = selected == 'release'
        ? await service.releaseReservation('${row['id']}', key)
        : await service.fulfillReservation('${row['id']}', key);
    _showResult(
      error,
      selected == 'release'
          ? 'Reservation released.'
          : 'Reservation fulfilled.',
    );
  }

  void _showResult(String? error, String success) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(error ?? success)));
  }
}
