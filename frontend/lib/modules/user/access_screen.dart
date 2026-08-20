import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import '../../core/auth/auth_service.dart';
import '../../modules/organization/organization_service.dart';
import '../../modules/branch/branch_service.dart';
import 'user_service.dart';

class UserAccessScreen extends StatefulWidget {
  const UserAccessScreen({Key? key}) : super(key: key);

  @override
  State<UserAccessScreen> createState() => _UserAccessScreenState();
}

class _UserAccessScreenState extends State<UserAccessScreen> {
  final userService = GetIt.instance.get<UserService>();
  final orgService = GetIt.instance.get<OrganizationService>();
  final branchService = GetIt.instance.get<BranchService>();

  String? selectedOrg;
  String? selectedBranch;
  bool loading = false;
  String? error;
  Map<String, dynamic>? user;

  @override
  void initState() {
    super.initState();
    orgService.fetchOrganizations();
  }

  Future<void> _loadUser(String id) async {
    final u = await userService.getUser(id);
    setState(() => user = u);
  }

  Future<void> _assignOrg(String userId) async {
    if (selectedOrg == null) return;
    setState(() { loading = true; error = null; });
    final ok = await userService.assignOrganizationAccess(userId, selectedOrg!);
    setState(() { loading = false; });
    if (!ok) setState(() => error = 'Failed to assign organization');
    else await _loadUser(userId);
  }

  Future<void> _assignBranch(String userId) async {
    if (selectedBranch == null) return;
    setState(() { loading = true; error = null; });
    final ok = await userService.assignBranchAccess(userId, selectedBranch!);
    setState(() { loading = false; });
    if (!ok) setState(() => error = 'Failed to assign branch');
    else await _loadUser(userId);
  }

  @override
  Widget build(BuildContext context) {
    final userId = ModalRoute.of(context)!.settings.arguments as String?;
    if (userId != null && user == null) _loadUser(userId);

    return Scaffold(
      appBar: AppBar(title: const Text('User Access')),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            if (orgService.isLoading) const LinearProgressIndicator(),
            DropdownButtonFormField<String>(
              items: orgService.organizations.map((o) => DropdownMenuItem(value: o['id'], child: Text(o['name'] ?? o['code'] ?? ''))).toList(),
              onChanged: (v) => setState(() => selectedOrg = v),
              decoration: const InputDecoration(labelText: 'Organization'),
            ),
            const SizedBox(height: 8),
            ElevatedButton(onPressed: userId == null ? null : () => _assignOrg(userId), child: const Text('Assign Organization')),
            const Divider(),
            DropdownButtonFormField<String>(
              items: branchService.branches.map((b) => DropdownMenuItem(value: b['id'], child: Text(b['name'] ?? b['code'] ?? ''))).toList(),
              onChanged: (v) => setState(() => selectedBranch = v),
              decoration: const InputDecoration(labelText: 'Branch'),
            ),
            const SizedBox(height: 8),
            ElevatedButton(onPressed: userId == null ? null : () => _assignBranch(userId), child: const Text('Assign Branch')),
            if (error != null) Padding(padding: const EdgeInsets.only(top:12.0), child: Text(error!, style: const TextStyle(color: Colors.red))),
          ],
        ),
      ),
    );
  }
}
