import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'sales_service.dart';

class SalesBoundaryDetailsScreen extends StatefulWidget {
  final String kind;
  final String id;
  final String title;
  const SalesBoundaryDetailsScreen({super.key, required this.kind, required this.id, required this.title});
  @override State<SalesBoundaryDetailsScreen> createState() => _SalesBoundaryDetailsScreenState();
}

class _SalesBoundaryDetailsScreenState extends State<SalesBoundaryDetailsScreen> {
  late final SalesService service = GetIt.instance.get<SalesService>();
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
