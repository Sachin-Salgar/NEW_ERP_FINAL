import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'sales_service.dart';

class SalesAdminListScreen extends StatefulWidget {
  final String kind;
  final String title;
  const SalesAdminListScreen({super.key, required this.kind, required this.title});
  @override State<SalesAdminListScreen> createState() => _SalesAdminListScreenState();
}

class _SalesAdminListScreenState extends State<SalesAdminListScreen> {
  late final SalesService service = GetIt.instance.get<SalesService>();
  late Future<List<Map<String, dynamic>>> request = service.fetchSalesAdministration(widget.kind);

  Future<void> _refresh() async {
    setState(() => request = service.fetchSalesAdministration(widget.kind));
    await request;
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(widget.title)),
    body: FutureBuilder<List<Map<String, dynamic>>>(
      future: request,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
        if (service.error != null && snapshot.data!.isEmpty) return Center(child: Text(service.error!));
        final rows = snapshot.data!;
        if (rows.isEmpty) return RefreshIndicator(onRefresh: _refresh, child: ListView(children: const [SizedBox(height: 180), Center(child: Text('No records found.'))]));
        return RefreshIndicator(
          onRefresh: _refresh,
          child: ListView.builder(
            itemCount: rows.length,
            itemBuilder: (_, index) {
              final row = rows[index];
              return ListTile(
                title: Text('${row['name'] ?? row['code'] ?? ''}'),
                subtitle: Text('${row['status'] ?? ''} • ${row['effectiveFrom'] ?? ''}'),
              );
            },
          ),
        );
      },
    ),
  );
}
