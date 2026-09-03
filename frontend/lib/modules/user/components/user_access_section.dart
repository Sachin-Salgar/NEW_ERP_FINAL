import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import '../../../core/auth/auth_service.dart';
import '../../branch/branch_service.dart';
import '../../organization/organization_service.dart';
import '../user_service.dart';

class UserAccessSection extends StatefulWidget {
  final String userId;
  final ValueChanged<String>? onAccessSummaryChanged;

  const UserAccessSection({
    super.key,
    required this.userId,
    this.onAccessSummaryChanged,
  });

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
  bool accessLoading = true;
  String? error;
  List<Map<String, dynamic>> assignedOrganizations = [];
  List<Map<String, dynamic>> assignedBranches = [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (!orgService.isLoading) orgService.fetchOrganizations();
      _loadAssignedAccess();
    });
  }

  Future<void> _loadAssignedAccess() async {
    if (!mounted) return;
    setState(() {
      accessLoading = true;
      error = null;
    });
    try {
      final access = await userService.getUserAccess(widget.userId);
      if (!mounted) return;
      setState(() {
        assignedOrganizations = access['organizations']!;
        assignedBranches = access['branches']!;
        accessLoading = false;
      });
      widget.onAccessSummaryChanged?.call(_summary);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        accessLoading = false;
        error = e.toString();
      });
      widget.onAccessSummaryChanged?.call('Unable to load access');
    }
  }

  String get _summary {
    if (accessLoading) return 'Loading access...';
    if (assignedOrganizations.isEmpty && assignedBranches.isEmpty) {
      return 'No organization/branch access';
    }
    final organizationCount =
        '${assignedOrganizations.length} organization${assignedOrganizations.length == 1 ? '' : 's'}';
    final branchCount =
        '${assignedBranches.length} branch${assignedBranches.length == 1 ? '' : 'es'}';
    return '$organizationCount • $branchCount';
  }

  Future<void> _assignOrg() async {
    if (selectedOrg == null) return;
    setState(() {
      loading = true;
      error = null;
    });
    final ok = await userService.assignOrganizationAccess(
      widget.userId,
      selectedOrg!,
    );
    if (!mounted) return;
    setState(() => loading = false);
    if (!ok) {
      setState(() => error = 'Failed to assign organization');
      return;
    }
    await _loadAssignedAccess();
  }

  Future<void> _assignBranch() async {
    if (selectedBranch == null) return;
    setState(() {
      loading = true;
      error = null;
    });
    final ok = await userService.assignBranchAccess(
      widget.userId,
      selectedBranch!,
    );
    if (!mounted) return;
    setState(() => loading = false);
    if (!ok) {
      setState(() => error = 'Failed to assign branch');
      return;
    }
    await _loadAssignedAccess();
  }

  @override
  Widget build(BuildContext context) {
    if (!auth.hasPermission('user.manage')) {
      return const Center(
        child: Text('You do not have permission to manage user access.'),
      );
    }
    return AnimatedBuilder(
      animation: orgService,
      builder: (context, _) => AnimatedBuilder(
        animation: branchService,
        builder: (context, _) => Column(
          children: [
            if (accessLoading) const LinearProgressIndicator(),
            if (!accessLoading) ...[
              Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'Assigned organizations',
                  style: Theme.of(context).textTheme.titleSmall,
                ),
              ),
              const SizedBox(height: 8),
              if (assignedOrganizations.isEmpty)
                const Align(
                  alignment: Alignment.centerLeft,
                  child: Text('No organizations assigned'),
                )
              else
                Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    assignedOrganizations
                        .map((organization) => organization['name'].toString())
                        .join(' • '),
                  ),
                ),
              const SizedBox(height: 16),
              Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'Assigned branches',
                  style: Theme.of(context).textTheme.titleSmall,
                ),
              ),
              const SizedBox(height: 8),
              if (assignedBranches.isEmpty)
                const Align(
                  alignment: Alignment.centerLeft,
                  child: Text('No branches assigned'),
                )
              else
                Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    assignedBranches
                        .map((branch) => branch['name'].toString())
                        .join(' • '),
                  ),
                ),
              const Divider(),
            ],
            if (orgService.isLoading) const LinearProgressIndicator(),
            DropdownButtonFormField<String>(
              items: orgService.organizations
                  .map(
                    (o) => DropdownMenuItem<String>(
                      value: o['id'] as String?,
                      child: Text(o['name'] ?? o['code'] ?? ''),
                    ),
                  )
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
                  .map(
                    (b) => DropdownMenuItem<String>(
                      value: b['id'] as String?,
                      child: Text(b['name'] ?? b['code'] ?? ''),
                    ),
                  )
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
