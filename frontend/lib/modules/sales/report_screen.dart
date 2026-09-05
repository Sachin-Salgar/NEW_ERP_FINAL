import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'sales_service.dart';

class SalesReportScreen extends StatefulWidget {
  const SalesReportScreen({super.key});
  @override State<SalesReportScreen> createState() => _SalesReportScreenState();
}

class _SalesReportScreenState extends State<SalesReportScreen> {
  late final SalesService service = GetIt.instance.get<SalesService>();
  late Future<List<Map<String, dynamic>>> request = service.fetchSalesReport();

  Future<void> _refresh() async {
    setState(() => request = service.fetchSalesReport());
    await request;
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Sales Report')),
    body: FutureBuilder<List<Map<String, dynamic>>>(
      future: request,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
        if (service.error != null && snapshot.data!.isEmpty) return Center(child: Text(service.error!));
        final rows = snapshot.data!;
        if (rows.isEmpty) return RefreshIndicator(onRefresh: _refresh, child: ListView(children: const [SizedBox(height: 180), Center(child: Text('No Sales documents found.'))]));
        return RefreshIndicator(
          onRefresh: _refresh,
          child: ListView.builder(
            itemCount: rows.length,
            itemBuilder: (_, index) {
              final row = rows[index];
              return ListTile(
                title: Text('${row['documentNumber'] ?? ''}'),
                subtitle: Text('${row['documentType'] ?? ''} • ${row['status'] ?? ''}'),
              );
            },
          ),
        );
      },
    ),
  );
}
