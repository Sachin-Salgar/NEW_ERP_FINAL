import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import '../../core/auth/auth_service.dart';
import 'sales_service.dart';

class SalesBoundaryListScreen extends StatefulWidget {
  final String kind;
  final String permission;
  final String title;
  const SalesBoundaryListScreen({super.key, required this.kind, required this.permission, required this.title});
  @override State<SalesBoundaryListScreen> createState() => _SalesBoundaryListScreenState();
}
class _SalesBoundaryListScreenState extends State<SalesBoundaryListScreen> {
  late final SalesService service = GetIt.instance.get<SalesService>();
  late final AuthService auth = GetIt.instance.get<AuthService>();
  @override void initState() { super.initState(); service.fetchBoundary(widget.kind); }
  @override Widget build(BuildContext context) {
    if (!auth.hasPermission(widget.permission)) return const Scaffold(body: Center(child: Text('You do not have permission to view this resource.')));
    return Scaffold(appBar: AppBar(title: Text(widget.title)), body: AnimatedBuilder(animation: service, builder: (_, __) {
      final values = widget.kind == 'returns' ? service.returns : service.creditNotes;
      if (service.isLoading && values.isEmpty) return const Center(child: CircularProgressIndicator());
      if (service.error != null && values.isEmpty) return Center(child: Text(service.error!));
      if (values.isEmpty) return const Center(child: Text('No records found.'));
      return ListView(children: values.map((value) => ListTile(title: Text('${value['returnNumber'] ?? value['creditNoteNumber'] ?? ''}'), subtitle: Text('${value['status'] ?? ''}'), onTap: () => Navigator.pushNamed(context, '/sales/${widget.kind}/${value['id']}'))).toList());
    }));
  }
}
