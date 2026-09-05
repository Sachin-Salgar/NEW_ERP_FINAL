import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'sales_service.dart';

class SalesReportScreen extends StatefulWidget {
  const SalesReportScreen({super.key});
  @override State<SalesReportScreen> createState() => _SalesReportScreenState();
}

class _SalesReportScreenState extends State<SalesReportScreen> {
  late final SalesService service = GetIt.instance.get<SalesService>();
  final search = TextEditingController();
  late Future<List<Map<String, dynamic>>> request =
      service.fetchSalesReport();

  @override
  void dispose() {
    search.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    setState(() => request = service.fetchSalesReport(search: search.text));
    await request;
  }

  void _loadPage(int page) {
    setState(() => request = service.fetchSalesReport(
          search: search.text,
          page: page,
        ));
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Sales Report')),
    body: FutureBuilder<List<Map<String, dynamic>>>(
      future: request,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
        if (service.error != null && (snapshot.data ?? const []).isEmpty) return Center(child: Text(service.error!));
        final rows = snapshot.data!;
        return RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            children: [
              Padding(
                padding: const EdgeInsets.all(16),
                child: TextField(
                  controller: search,
                  decoration: InputDecoration(
                    labelText: 'Search document number',
                    suffixIcon: IconButton(
                      icon: const Icon(Icons.search),
                      onPressed: _refresh,
                    ),
                  ),
                  onSubmitted: (_) => _refresh(),
                ),
              ),
              if (rows.isEmpty)
                const SizedBox(
                  height: 180,
                  child: Center(child: Text('No Sales documents found.')),
                )
              else
                ...rows.map((row) => ListTile(
                      title: Text('${row['documentNumber'] ?? ''}'),
                      subtitle: Text(
                        '${row['documentType'] ?? ''} • ${row['status'] ?? ''}',
                      ),
                    )),
              if (service.reportTotalPages > 1)
                OverflowBar(
                  alignment: MainAxisAlignment.center,
                  children: [
                    IconButton(
                      onPressed: service.reportPage > 1
                          ? () => _loadPage(service.reportPage - 1)
                          : null,
                      icon: const Icon(Icons.chevron_left),
                    ),
                    Text(
                      '${service.reportPage} / ${service.reportTotalPages}',
                    ),
                    IconButton(
                      onPressed: service.reportPage < service.reportTotalPages
                          ? () => _loadPage(service.reportPage + 1)
                          : null,
                      icon: const Icon(Icons.chevron_right),
                    ),
                  ],
                ),
            ],
          ),
        );
      },
    ),
  );
}
