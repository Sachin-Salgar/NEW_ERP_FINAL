import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import '../../core/auth/auth_service.dart';
import 'sales_service.dart';

class SalesDocumentListScreen extends StatefulWidget {
  final String kind;
  final String title;
  final String permission;
  const SalesDocumentListScreen({super.key, required this.kind, required this.title, required this.permission});
  @override State<SalesDocumentListScreen> createState() => _SalesDocumentListScreenState();
}

class _SalesDocumentListScreenState extends State<SalesDocumentListScreen> {
  late final SalesService service = GetIt.instance.get<SalesService>();
  late final AuthService auth = GetIt.instance.get<AuthService>();
  final search = TextEditingController();
  late Future<List<Map<String, dynamic>>> request = service.fetchSalesDocuments(widget.kind);
  Future<void> refresh() async { setState(() => request = service.fetchSalesDocuments(widget.kind, search: search.text)); await request; }
  @override void dispose() { search.dispose(); super.dispose(); }
  @override Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(widget.title)),
    body: FutureBuilder<List<Map<String, dynamic>>>(
      future: request,
      builder: (context, snapshot) {
        if (!auth.hasPermission(widget.permission)) return const Center(child: Text('You do not have permission to view this document.'));
        if (snapshot.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
        if (service.error != null && (snapshot.data ?? []).isEmpty) return Center(child: Text(service.error!));
        final rows = snapshot.data ?? const <Map<String, dynamic>>[];
        return RefreshIndicator(
          onRefresh: refresh,
          child: ListView(
            children: [
              Padding(padding: const EdgeInsets.all(16), child: TextField(controller: search, onSubmitted: (_) => refresh(), decoration: InputDecoration(labelText: 'Search ${widget.title}', suffixIcon: IconButton(onPressed: refresh, icon: const Icon(Icons.search))))),
              if (rows.isEmpty) const Padding(padding: EdgeInsets.all(32), child: Center(child: Text('No records found.'))),
              ...rows.map((row) => ListTile(
                title: Text('${row[widget.kind == 'orders' ? 'orderNumber' : 'deliveryNumber'] ?? ''}'),
                subtitle: Text('${row['status'] ?? ''}'),
                onTap: () => Navigator.pushNamed(context, '/sales/${widget.kind}/${row['id']}').then((_) => refresh()),
              )),
            ],
          ),
        );
      },
    ),
  );
}
