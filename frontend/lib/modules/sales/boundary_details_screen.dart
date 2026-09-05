import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'sales_service.dart';
import '../../core/auth/auth_service.dart';

class SalesBoundaryDetailsScreen extends StatefulWidget {
  final String kind;
  final String id;
  final String title;
  const SalesBoundaryDetailsScreen({super.key, required this.kind, required this.id, required this.title});
  @override State<SalesBoundaryDetailsScreen> createState() => _SalesBoundaryDetailsScreenState();
}

class _SalesBoundaryDetailsScreenState extends State<SalesBoundaryDetailsScreen> {
  late final SalesService service = GetIt.instance.get<SalesService>();
  late final AuthService auth = GetIt.instance.get<AuthService>();
  Map<String, dynamic>? value;
  String? error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final result = await service.getBoundary(widget.kind, widget.id);
    if (!mounted) return;
    setState(() {
      value = result;
      error = result == null ? service.error : null;
    });
  }

  Future<void> _transition(String action) async {
    final expectedVersion = (value?['versionNumber'] as num?)?.toInt() ?? 0;
    final result = await service.transitionBoundary(widget.kind, widget.id, action, expectedVersion);
    if (!mounted) return;
    if (result == null) {
      await _load();
    } else {
      setState(() => error = result);
    }
  }

  @override
  Widget build(BuildContext context) {
    final record = value;
    return Scaffold(
      appBar: AppBar(title: Text(widget.title)),
      body: error != null
          ? Center(child: Text(error!))
          : record == null
              ? const Center(child: CircularProgressIndicator())
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      Text(record['returnNumber'] ?? record['creditNoteNumber'] ?? '', style: Theme.of(context).textTheme.headlineSmall),
                      const SizedBox(height: 8),
                      Text('Status: ${record['status'] ?? ''}'),
                      Text('Customer: ${record['customerId'] ?? ''}'),
                      Text('Version: ${record['versionNumber'] ?? ''}'),
                      if (widget.kind == 'returns') ...[
                        if (record['status'] == 'REQUESTED' && auth.hasPermission('sales.return.inspect'))
                          FilledButton(onPressed: () => _transition('inspect'), child: const Text('Inspect')),
                        if (record['status'] == 'INSPECTED' && auth.hasPermission('sales.return.approve'))
                          FilledButton(onPressed: () => _transition('approve'), child: const Text('Approve')),
                        if (record['status'] == 'APPROVED' && auth.hasPermission('sales.return.process'))
                          FilledButton(onPressed: () => _transition('process'), child: const Text('Process')),
                        if (record['status'] == 'PROCESSED' && auth.hasPermission('sales.return.close'))
                          FilledButton(onPressed: () => _transition('close'), child: const Text('Close')),
                        if (record['status'] == 'REQUESTED' && auth.hasPermission('sales.return.cancel'))
                          OutlinedButton(onPressed: () => _transition('cancel'), child: const Text('Cancel')),
                      ] else ...[
                        if (record['status'] == 'DRAFT' && auth.hasPermission('sales.credit_note.issue'))
                          FilledButton(onPressed: () => _transition('issue'), child: const Text('Issue')),
                        if (record['status'] == 'DRAFT' && auth.hasPermission('sales.credit_note.cancel'))
                          OutlinedButton(onPressed: () => _transition('cancel'), child: const Text('Cancel')),
                      ],
                      const SizedBox(height: 16),
                      ...(record['items'] as List<dynamic>? ?? const []).map((item) {
                        final line = Map<String, dynamic>.from(item as Map);
                        return ListTile(
                          title: Text(line['description']?.toString() ?? ''),
                          subtitle: Text('Quantity: ${line['quantity'] ?? ''} ${line['unitOfMeasure'] ?? ''}'),
                          trailing: Text('${line['unitPrice'] ?? ''}'),
                        );
                      }),
                    ],
                  ),
                ),
    );
  }
}
