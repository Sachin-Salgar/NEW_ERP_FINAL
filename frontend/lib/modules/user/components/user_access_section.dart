import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import '../../../core/auth/auth_service.dart';
import '../../branch/branch_service.dart';
import '../../organization/organization_service.dart';
import '../user_service.dart';

class UserAccessSection extends StatefulWidget {
  final String userId;

  const UserAccessSection({super.key, required this.userId});

  @override
  State<UserAccessSection> createState() => _UserAccessSectionState();
}

class _UserAccessSectionState extends State<UserAccessSection> {
  final userService = GetIt.instance.get<UserService>();
  final auth = GetIt.instance.get<AuthService>();
  final orgService = GetIt.instance.get<OrganizationService>();
  final branchService = GetIt.instance.get<BranchService>();
  String? selectedOrg;
  String? selectedBranch;
  bool loading = false;
  String? error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && !orgService.isLoading) orgService.fetchOrganizations();
    });
  }

  Future<void> _assignOrg() async {
    if (selectedOrg == null) return;
    setState(() {
      loading = true;
      error = null;
    });
    final ok = await userService.assignOrganizationAccess(widget.userId, selectedOrg!);
    if (!mounted) return;
    setState(() => loading = false);
    if (!ok) setState(() => error = 'Failed to assign organization');
  }

  Future<void> _assignBranch() async {
    if (selectedBranch == null) return;
    setState(() {
      loading = true;
      error = null;
    });
    final ok = await userService.assignBranchAccess(widget.userId, selectedBranch!);
    if (!mounted) return;
    setState(() => loading = false);
    if (!ok) setState(() => error = 'Failed to assign branch');
  }

  @override
  Widget build(BuildContext context) {
    if (!auth.hasPermission('user.manage')) {
      return const Center(child: Text('You do not have permission to manage user access.'));
    }
    return AnimatedBuilder(
      animation: orgService,
      builder: (context, _) => AnimatedBuilder(
        animation: branchService,
        builder: (context, _) => Column(
          children: [
            if (orgService.isLoading) const LinearProgressIndicator(),
            DropdownButtonFormField<String>(
              items: orgService.organizations
                  .map((o) => DropdownMenuItem<String>(
                        value: o['id'] as String?,
                        child: Text(o['name'] ?? o['code'] ?? ''),
                      ))
                  .toList(),
              onChanged: (value) {
                setState(() {
                  selectedOrg = value;
                  selectedBranch = null;
                });
                if (value != null) branchService.fetchBranches(value);
              },
              decoration: const InputDecoration(labelText: 'Organization'),
            ),
            const SizedBox(height: 8),
            ElevatedButton(
              onPressed: loading ? null : _assignOrg,
              child: const Text('Assign Organization'),
            ),
            const Divider(),
            DropdownButtonFormField<String>(
              items: branchService.branches
                  .map((b) => DropdownMenuItem<String>(
                        value: b['id'] as String?,
                        child: Text(b['name'] ?? b['code'] ?? ''),
                      ))
                  .toList(),
              onChanged: (value) => setState(() => selectedBranch = value),
              decoration: const InputDecoration(labelText: 'Branch'),
            ),
            const SizedBox(height: 8),
            ElevatedButton(
              onPressed: loading ? null : _assignBranch,
              child: const Text('Assign Branch'),
            ),
            if (error != null)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Text(error!, style: const TextStyle(color: Colors.red)),
              ),
          ],
        ),
      ),
    );
  }
}
