import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import '../../core/auth/auth_service.dart';
import 'sales_service.dart';

class SalesAdminDetailsScreen extends StatefulWidget {
  final String kind;
  final String id;
  const SalesAdminDetailsScreen({super.key, required this.kind, required this.id});
  @override State<SalesAdminDetailsScreen> createState() => _SalesAdminDetailsScreenState();
}

class _SalesAdminDetailsScreenState extends State<SalesAdminDetailsScreen> {
  late final SalesService service = GetIt.instance.get<SalesService>();
  late final AuthService auth = GetIt.instance.get<AuthService>();
  Map<String, dynamic>? value;
  String? error;
  final itemCode = TextEditingController();
  final uom = TextEditingController();
  final price = TextEditingController();
  final percentage = TextEditingController();
  @override void initState() { super.initState(); load(); }
  @override void dispose() { itemCode.dispose(); uom.dispose(); price.dispose(); percentage.dispose(); super.dispose(); }
  Future<void> load() async { final result = await service.getSalesAdministration(widget.kind, widget.id); if (mounted) setState(() { value = result; error = result == null ? service.error : null; }); }
  Future<void> addItem() async {
    final result = await service.addPriceListItem(widget.id, {'itemCode': itemCode.text.trim(), 'unitOfMeasure': uom.text.trim(), 'price': double.tryParse(price.text), 'effectiveFrom': DateTime.now().toIso8601String().substring(0, 10)});
    if (!mounted) return;
    if (result == null) { itemCode.clear(); uom.clear(); price.clear(); load(); } else setState(() => error = result);
  }
  Future<void> updateDiscount() async {
    final result = await service.updateDiscountRule(widget.id, {'name': value?['name'], 'percentage': double.tryParse(percentage.text), 'effectiveFrom': value?['effectiveFrom'], 'effectiveTo': value?['effectiveTo'], 'expectedVersion': value?['versionNumber']});
    if (!mounted) return;
    if (result == null) load(); else setState(() => error = result);
  }
  @override Widget build(BuildContext context) {
    if (value == null) return Scaffold(appBar: AppBar(title: const Text('Sales administration')), body: Center(child: error == null ? const CircularProgressIndicator() : Text(error!)));
    final isPricing = widget.kind == 'price-lists';
    final status = '${value!['status'] ?? ''}';
    final permission = isPricing ? 'sales.pricing' : 'sales.discount';
    return Scaffold(appBar: AppBar(title: Text('${value!['name'] ?? value!['code'] ?? ''}')), body: ListView(padding: const EdgeInsets.all(16), children: [
      Text('Status: $status'),
      if (isPricing) ...[
        Text('Currency: ${value!['currency'] ?? ''}'),
        ...((value!['items'] as List<dynamic>?) ?? const []).map((item) => ListTile(title: Text('${item['itemCode'] ?? ''}'), subtitle: Text('${item['unitOfMeasure'] ?? ''}'), trailing: Text('${item['price'] ?? ''}'))),
        if (status == 'DRAFT' && auth.hasPermission('$permission.update')) ...[
          TextField(controller: itemCode, decoration: const InputDecoration(labelText: 'Item code')),
          TextField(controller: uom, decoration: const InputDecoration(labelText: 'Unit of measure')),
          TextField(controller: price, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Price')),
          FilledButton(onPressed: addItem, child: const Text('Add item')),
        ],
      ] else if (status == 'DRAFT' && auth.hasPermission('$permission.update')) ...[
        TextField(controller: percentage, decoration: InputDecoration(labelText: 'Percentage', hintText: '${value!['percentage'] ?? ''}')),
        FilledButton(onPressed: updateDiscount, child: const Text('Save draft')),
      ],
      if (status == 'DRAFT' && auth.hasPermission('$permission.publish')) FilledButton(onPressed: () async { final e = await service.transitionSalesAdministration(widget.kind, widget.id, 'publish', (value!['versionNumber'] as num?)?.toInt() ?? 1); if (e == null) load(); }, child: const Text('Publish')),
      if (status == 'PUBLISHED' && auth.hasPermission('$permission.archive')) OutlinedButton(onPressed: () async { final e = await service.transitionSalesAdministration(widget.kind, widget.id, 'archive', (value!['versionNumber'] as num?)?.toInt() ?? 1); if (e == null) load(); }, child: const Text('Archive')),
      if (error != null) Text(error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
    ]));
  }
}
