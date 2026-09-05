import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import '../../core/auth/auth_service.dart';
import 'sales_service.dart';

class SalesDocumentDetailsScreen extends StatefulWidget {
  final String kind;
  final String id;
  const SalesDocumentDetailsScreen({super.key, required this.kind, required this.id});
  @override State<SalesDocumentDetailsScreen> createState() => _SalesDocumentDetailsScreenState();
}

class _SalesDocumentDetailsScreenState extends State<SalesDocumentDetailsScreen> {
  late final SalesService service = GetIt.instance.get<SalesService>();
  late final AuthService auth = GetIt.instance.get<AuthService>();
  Map<String, dynamic>? value;
  String? error;
  @override void initState() { super.initState(); load(); }
  Future<void> load() async { final result = await service.getSalesDocument(widget.kind, widget.id); if (mounted) setState(() { value = result; error = result == null ? service.error : null; }); }
  Future<void> transition(String action) async { final result = await service.transitionSalesDocument(widget.kind, widget.id, action, (value?['versionNumber'] as num?)?.toInt() ?? 0); if (!mounted) return; if (result == null) load(); else setState(() => error = result); }
  @override Widget build(BuildContext context) {
    if (value == null) return Scaffold(appBar: AppBar(title: Text(widget.kind)), body: Center(child: error == null ? const CircularProgressIndicator() : Text(error!)));
    final status = '${value!['status'] ?? ''}';
    final prefix = widget.kind == 'orders' ? 'sales.order' : 'sales.delivery';
    final actions = widget.kind == 'orders'
        ? <String, String>{if (status == 'DRAFT' && auth.hasPermission('$prefix.confirm')) 'confirm': 'Confirm', if (status == 'CONFIRMED' && auth.hasPermission('$prefix.close')) 'close': 'Close', if ((status == 'DRAFT' || status == 'CONFIRMED') && auth.hasPermission('$prefix.cancel')) 'cancel': 'Cancel'}
        : <String, String>{if (status == 'DRAFT' && auth.hasPermission('$prefix.dispatch')) 'dispatch': 'Dispatch', if (status == 'DISPATCHED' && auth.hasPermission('$prefix.deliver')) 'deliver': 'Deliver', if (status == 'DELIVERED' && auth.hasPermission('$prefix.complete')) 'complete': 'Complete', if (status != 'COMPLETED' && status != 'CANCELLED' && auth.hasPermission('$prefix.cancel')) 'cancel': 'Cancel'};
    final items = (value!['items'] as List<dynamic>?) ?? const [];
    return Scaffold(appBar: AppBar(title: Text('${value![widget.kind == 'orders' ? 'orderNumber' : 'deliveryNumber'] ?? widget.kind}')), body: ListView(padding: const EdgeInsets.all(16), children: [Text('Status: $status'), Text('Customer: ${value!['customerId'] ?? ''}'), ...items.map((item) => ListTile(title: Text('${item['description'] ?? ''}'), subtitle: Text('${item['quantity'] ?? ''} ${item['unitOfMeasure'] ?? ''}'))), if (actions.isNotEmpty) Wrap(spacing: 8, children: actions.entries.map((entry) => FilledButton(onPressed: () => transition(entry.key), child: Text(entry.value))).toList()), if (error != null) Text(error!, style: const TextStyle(color: Colors.red))]));
  }
}
