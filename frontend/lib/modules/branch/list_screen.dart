import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'package:provider/provider.dart';
import '../../core/auth/auth_service.dart';
import '../../core/network/api_client.dart';
import '../organization/organization_service.dart';
import 'branch_service.dart';

class BranchListScreen extends StatefulWidget {
  final String organizationId;
  const BranchListScreen({Key? key, required this.organizationId}) : super(key: key);

  @override
  State<BranchListScreen> createState() => _BranchListScreenState();
}

class _BranchListScreenState extends State<BranchListScreen> {
  late BranchService service;
  late AuthService auth;

  @override
  void initState() {
    super.initState();
    final api = GetIt.instance.get<ApiClient>();
    service = BranchService(apiClient: api);
    auth = GetIt.instance.get<AuthService>();
    _init();
  }

  Future<void> _init() async {
    await auth.fetchEffectivePermissions(const String.fromEnvironment('API_BASE_URL', defaultValue: 'http://localhost:3001'));
    await service.fetchBranches(widget.organizationId);
  }

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider<BranchService>.value(
      value: service,
      child: Consumer<BranchService>(
        builder: (context, svc, _) {
          if (svc.isLoading) return const Center(child: CircularProgressIndicator());
          if (svc.error != null) return Center(child: Text('Error: ${svc.error}'));

          final canRead = auth.hasPermission('branch.read');
          if (!canRead) return Center(child: Text('You do not have permission to view branches.'));

          final items = svc.branches;
          return Scaffold(
            appBar: AppBar(title: const Text('Branches')),
            body: RefreshIndicator(
              onRefresh: () => svc.fetchBranches(widget.organizationId),
              child: items.isEmpty
                  ? ListView(children: [Center(child: Padding(padding: EdgeInsets.all(24), child: Text('No branches found.')))])
                  : ListView.builder(
                      itemCount: items.length,
                      itemBuilder: (context, index) {
                        final b = items[index];
                        return ListTile(
                          title: Text(b['name'] ?? b['code'] ?? 'Unnamed'),
                          subtitle: Text(b['city'] ?? ''),
                          onTap: () => Navigator.of(context).pushNamed('/organizations/branches/details', arguments: {'organizationId': widget.organizationId, 'branchId': b['id']}),
                        );
                      },
                    ),
            ),
            floatingActionButton: auth.hasPermission('branch.manage')
                ? FloatingActionButton(
                    onPressed: () => Navigator.of(context).pushNamed('/organizations/branches/create', arguments: widget.organizationId),
                    child: Icon(Icons.add),
                  )
                : null,
          );
        },
      ),
    );
  }
}
