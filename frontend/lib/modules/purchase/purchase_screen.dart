import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_service.dart';
import '../../presentation/ui/components/page_header.dart';
import 'purchase_service.dart';

class PurchaseScreen extends StatefulWidget {
  const PurchaseScreen({super.key});
  @override
  State<PurchaseScreen> createState() => _PurchaseScreenState();
}

class _PurchaseScreenState extends State<PurchaseScreen>
    with SingleTickerProviderStateMixin {
  late final PurchaseService service;
  late final AuthService auth;
  late final TabController tabs;
  final search = TextEditingController();
  final names = const [
    'suppliers',
    'requisitions',
    'purchaseOrders',
    'receipts',
  ];
  final titles = const [
    'Suppliers',
    'Requisitions',
    'Purchase Orders',
    'Receipts',
  ];
  @override
  void initState() {
    super.initState();
    service = GetIt.I<PurchaseService>();
    auth = GetIt.I<AuthService>();
    tabs = TabController(length: 4, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) => service.load());
  }

  @override
  void dispose() {
    tabs.dispose();
    search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ChangeNotifierProvider.value(
    value: service,
    child: Consumer<PurchaseService>(
      builder: (context, svc, _) {
        if (!auth.hasPermission('purchase.supplier.read'))
          return const Center(
            child: Text('You do not have permission to view Purchase.'),
          );
        final type = names[tabs.index];
        return Scaffold(
          body: RefreshIndicator(
            onRefresh: svc.load,
            child: CustomScrollView(
              slivers: [
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(24, 24, 24, 0),
                  sliver: SliverToBoxAdapter(
                    child: ErpPageHeader(
                      title: 'Purchase',
                      subtitle: 'Suppliers, requisitions, orders and receipts',
                      breadcrumbs: const [
                        ErpBreadcrumbItem(label: 'Dashboard'),
                        ErpBreadcrumbItem(label: 'Purchase'),
                      ],
                      actions: _canCreate(type)
                          ? [
                              FilledButton.icon(
                                onPressed: () => _create(type),
                                icon: const Icon(Icons.add),
                                label: Text(
                                  'Add ${titles[tabs.index].replaceFirst(RegExp('s\$'), '')}',
                                ),
                              ),
                            ]
                          : null,
                    ),
                  ),
                ),
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(24, 12, 24, 0),
                  sliver: SliverToBoxAdapter(
                    child: TabBar(
                      controller: tabs,
                      onTap: (_) => setState(() {}),
                      tabs: titles.map(Text.new).toList(),
                    ),
                  ),
                ),
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(24, 12, 24, 0),
                  sliver: SliverToBoxAdapter(
                    child: TextField(
                      controller: search,
                      onChanged: (_) => setState(() {}),
                      decoration: const InputDecoration(
                        prefixIcon: Icon(Icons.search),
                        labelText: 'Search current list',
                      ),
                    ),
                  ),
                ),
                if ((svc.loading[type] ?? false) && svc.records[type]!.isEmpty)
                  const SliverFillRemaining(
                    hasScrollBody: false,
                    child: Center(child: CircularProgressIndicator()),
                  )
                else if (svc.errors[type] != null)
                  SliverFillRemaining(
                    hasScrollBody: false,
                    child: Center(child: Text(svc.errors[type]!)),
                  )
                else
                  _list(type, svc),
              ],
            ),
          ),
        );
      },
    ),
  );
  bool _canCreate(String type) => auth.hasPermission(
    'purchase.${type == 'purchaseOrders' ? 'order' : type.substring(0, type.length - 1)}.create',
  );
  Widget _list(String type, PurchaseService svc) {
    final input = svc.records[type]!;
    final q = search.text.trim().toLowerCase();
    final rows = input
        .where(
          (x) =>
              q.isEmpty || x.values.any((v) => '$v'.toLowerCase().contains(q)),
        )
        .toList();
    return SliverPadding(
      padding: const EdgeInsets.all(24),
      sliver: SliverList(
        delegate: SliverChildListDelegate([
          if (rows.isEmpty)
            const Padding(
              padding: EdgeInsets.all(32),
              child: Center(child: Text('No records found.')),
            ),
          ...rows.map(
            (item) => Card(
              child: ListTile(
                title: Text(
                  '${item['name'] ?? item['documentNumber'] ?? item['number'] ?? item['id'] ?? ''}',
                ),
                subtitle: Text(
                  '${item['status'] ?? item['code'] ?? item['email'] ?? ''}',
                ),
                trailing: PopupMenuButton<String>(
                  onSelected: (a) => _action(type, item, a),
                  itemBuilder: (_) => [
                    const PopupMenuItem(value: 'view', child: Text('View')),
                    if (type == 'suppliers' &&
                        auth.hasPermission('purchase.supplier.update'))
                      const PopupMenuItem(value: 'edit', child: Text('Edit')),
                    if (type != 'receipts' &&
                        type != 'suppliers' &&
                        auth.hasPermission(
                          'purchase.${type == 'purchaseOrders' ? 'order' : 'requisition'}.update',
                        ))
                      const PopupMenuItem(value: 'edit', child: Text('Edit')),
                    if (type == 'suppliers' &&
                        auth.hasPermission('purchase.supplier.delete'))
                      const PopupMenuItem(
                        value: 'delete',
                        child: Text('Delete'),
                      ),
                    ..._workflowActions(type, item),
                  ],
                ),
              ),
            ),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              IconButton(
                onPressed: svc.pages[type]! > 1
                    ? () => svc.load(type: type, page: svc.pages[type]! - 1)
                    : null,
                icon: const Icon(Icons.chevron_left),
              ),
              Text('Page ${svc.pages[type]} of ${svc.totalPages(type)}'),
              IconButton(
                onPressed: svc.pages[type]! < svc.totalPages(type)
                    ? () => svc.load(type: type, page: svc.pages[type]! + 1)
                    : null,
                icon: const Icon(Icons.chevron_right),
              ),
            ],
          ),
        ]),
      ),
    );
  }

  List<PopupMenuEntry<String>> _workflowActions(
    String type,
    Map<String, dynamic> item,
  ) {
    final status = '${item['status'] ?? 'DRAFT'}'.toUpperCase();
    if (type == 'receipts')
      return [
        if (status == 'DRAFT' &&
            auth.hasPermission('purchase.receipt.complete'))
          const PopupMenuItem(value: 'complete', child: Text('Complete')),
        if (status == 'DRAFT' && auth.hasPermission('purchase.receipt.cancel'))
          const PopupMenuItem(value: 'cancel', child: Text('Cancel')),
      ];
    final singular = type == 'purchaseOrders'
        ? 'order'
        : type.substring(0, type.length - 1);
    return [
      if (status == 'DRAFT' && auth.hasPermission('purchase.$singular.submit'))
        const PopupMenuItem(value: 'submit', child: Text('Submit')),
      if (status == 'SUBMITTED' &&
          auth.hasPermission('purchase.$singular.approve'))
        const PopupMenuItem(value: 'approve', child: Text('Approve')),
      if (status == 'SUBMITTED' &&
          auth.hasPermission('purchase.$singular.reject'))
        const PopupMenuItem(value: 'reject', child: Text('Reject')),
      if ((status == 'DRAFT' || status == 'SUBMITTED') &&
          auth.hasPermission('purchase.$singular.cancel'))
        const PopupMenuItem(value: 'cancel', child: Text('Cancel')),
    ];
  }

  Future<void> _action(
    String type,
    Map<String, dynamic> item,
    String action,
  ) async {
    if (action == 'view') {
      final detail = await service.get(type, '${item['id']}');
      if (mounted && detail != null) _showDetail(type, detail);
      return;
    }
    if (action == 'edit') {
      final data = await _form(type, item);
      if (data != null) {
        data['expectedVersion'] = item['version'] ?? 1;
        await service.update(type, '${item['id']}', data);
      }
      return;
    }
    if (action == 'delete') {
      if (!await _confirm('Delete this supplier?')) return;
      await service.removeSupplier(
        '${item['id']}',
        (item['version'] as num?)?.toInt() ?? 1,
      );
      return;
    }
    if (!await _confirm('Apply the $action action to this document?')) return;
    final status = action == 'complete'
        ? 'COMPLETED'
        : action == 'cancel'
        ? 'CANCELLED'
        : action == 'approve'
        ? 'APPROVED'
        : action == 'reject'
        ? 'REJECTED'
        : 'SUBMITTED';
    await service.workflow(
      type,
      '${item['id']}',
      status,
      (item['version'] as num?)?.toInt() ?? 1,
      action: action,
    );
  }

  Future<bool> _confirm(String message) async {
    final result = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('No'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Yes'),
          ),
        ],
      ),
    );
    return result == true;
  }

  void _showDetail(String type, Map<String, dynamic> d) => showDialog(
    context: context,
    builder: (_) => AlertDialog(
      title: Text(titles[names.indexOf(type)]),
      content: SingleChildScrollView(
        child: Text(d.entries.map((e) => '${e.key}: ${e.value}').join('\n')),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Close'),
        ),
      ],
    ),
  );
  Future<void> _create(String type) async {
    final data = await _form(type);
    if (data != null) await service.create(type, data);
  }

  Future<Map<String, dynamic>?> _form(
    String type, [
    Map<String, dynamic>? initial,
  ]) async {
    final name = TextEditingController(text: '${initial?['name'] ?? ''}');
    final code = TextEditingController(text: '${initial?['code'] ?? ''}');
    final email = TextEditingController(text: '${initial?['email'] ?? ''}');
    final date = TextEditingController(
      text:
          '${initial?['requiredDate'] ?? initial?['orderDate'] ?? initial?['receiptDate'] ?? ''}',
    );
    final justification = TextEditingController(
      text: '${initial?['justification'] ?? ''}',
    );
    final supplierId = TextEditingController(
      text: '${initial?['supplierId'] ?? ''}',
    );
    final requisitionId = TextEditingController(
      text: '${initial?['requisitionId'] ?? ''}',
    );
    final purchaseOrderId = TextEditingController(
      text: '${initial?['purchaseOrderId'] ?? ''}',
    );
    final warehouseId = TextEditingController(
      text: '${initial?['warehouseId'] ?? ''}',
    );
    final itemId = TextEditingController(text: '${initial?['itemId'] ?? ''}');
    final description = TextEditingController(
      text: '${initial?['description'] ?? ''}',
    );
    final quantity = TextEditingController(
      text: '${initial?['quantity'] ?? 1}',
    );
    final unitPrice = TextEditingController(
      text: '${initial?['unitPrice'] ?? 0}',
    );
    final uom = TextEditingController(
      text: '${initial?['unitOfMeasure'] ?? 'EA'}',
    );
    final formKey = GlobalKey<FormState>();
    final isSupplier = type == 'suppliers';
    final isRequisition = type == 'requisitions';
    final isOrder = type == 'purchaseOrders';
    final isReceipt = type == 'receipts';
    final canEditLines = initial == null || isReceipt;
    final result = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(
          '${initial == null ? 'Create' : 'Edit'} ${titles[names.indexOf(type)]}',
        ),
        content: Form(
          key: formKey,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (isSupplier) ...[
                  _field(name, 'Supplier name', required: true),
                  if (initial == null) _field(code, 'Supplier code'),
                  _field(email, 'Email'),
                ],
                if (isRequisition) ...[
                  _field(date, 'Required date', required: true),
                  _field(justification, 'Justification'),
                ],
                if (isOrder) ...[
                  _field(supplierId, 'Supplier ID', required: true),
                  _field(requisitionId, 'Requisition ID'),
                  _field(date, 'Order date', required: true),
                ],
                if (isReceipt) ...[
                  _field(
                    purchaseOrderId,
                    'Approved purchase order ID',
                    required: true,
                  ),
                  _field(warehouseId, 'Warehouse ID', required: true),
                  _field(date, 'Receipt date', required: true),
                ],
                if (canEditLines && !isSupplier) ...[
                  const SizedBox(height: 12),
                  const Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      'Receipt / document line',
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                  ),
                  _field(itemId, 'Item ID', required: true),
                  if (!isReceipt)
                    _field(description, 'Description', required: true),
                  _field(quantity, 'Quantity', required: true, numeric: true),
                  if (!isReceipt)
                    _field(unitPrice, 'Unit price', numeric: true),
                  if (!isReceipt)
                    _field(uom, 'Unit of measure', required: true),
                ],
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              if (!formKey.currentState!.validate()) return;
              final line = {
                'itemId': itemId.text.trim(),
                'description': description.text.trim(),
                'quantity': num.parse(quantity.text.trim()),
                'unitPrice': num.parse(unitPrice.text.trim()),
                'unitOfMeasure': uom.text.trim(),
              };
              final d = isSupplier
                  ? {
                      'name': name.text.trim(),
                      'code': code.text.trim(),
                      'email': email.text.trim(),
                    }
                  : isRequisition
                  ? {
                      'requiredDate': date.text.trim(),
                      'justification': justification.text.trim(),
                      'lines': [line],
                    }
                  : isOrder
                  ? {
                      'supplierId': supplierId.text.trim(),
                      if (requisitionId.text.trim().isNotEmpty)
                        'requisitionId': requisitionId.text.trim(),
                      'orderDate': date.text.trim(),
                      'lines': [line],
                    }
                  : {
                      'purchaseOrderId': purchaseOrderId.text.trim(),
                      'warehouseId': warehouseId.text.trim(),
                      'receiptDate': date.text.trim(),
                      if (initial == null)
                        'operationKey': DateTime.now().microsecondsSinceEpoch
                            .toString(),
                      'lines': [
                        {
                          'itemId': itemId.text.trim(),
                          'quantity': num.parse(quantity.text.trim()),
                        },
                      ],
                    };
              Navigator.pop(context, d);
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
    for (final controller in [
      name,
      code,
      email,
      date,
      justification,
      supplierId,
      requisitionId,
      purchaseOrderId,
      warehouseId,
      itemId,
      description,
      quantity,
      unitPrice,
      uom,
    ]) {
      controller.dispose();
    }
    return result;
  }

  Widget _field(
    TextEditingController controller,
    String label, {
    bool required = false,
    bool numeric = false,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: TextFormField(
      controller: controller,
      keyboardType: numeric
          ? const TextInputType.numberWithOptions(decimal: true)
          : TextInputType.text,
      decoration: InputDecoration(labelText: label),
      validator: (value) {
        if (required && (value == null || value.trim().isEmpty)) {
          return '$label is required';
        }
        if (numeric &&
            value != null &&
            value.trim().isNotEmpty &&
            num.tryParse(value.trim()) == null) {
          return '$label must be numeric';
        }
        return null;
      },
    ),
  );
}
