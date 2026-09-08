import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import '../../../core/auth/auth_service.dart';
import '../../branch/branch_service.dart';
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
  final branchService = GetIt.instance.get<BranchService>();
  String? selectedBranch;
  bool loading = false, accessLoading = true;
  String? error;
  List<Map<String, dynamic>> assignedBranches = [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      branchService.fetchBranches();
      _loadAssignedAccess();
    });
  }

  Future<void> _loadAssignedAccess() async {
    if (!auth.hasPermission('user.read')) return;
    setState(() {
      accessLoading = true;
      error = null;
    });
    try {
      final access = await userService.getUserAccess(widget.userId);
      if (!mounted) return;
      setState(() {
        assignedBranches = access['branches'] ?? <Map<String, dynamic>>[];
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

  String get _summary => accessLoading
      ? 'Loading access...'
      : assignedBranches.isEmpty
          ? 'No branch access'
          : '${assignedBranches.length} branch${assignedBranches.length == 1 ? '' : 'es'}';

  Future<void> _assignBranch() async {
    if (!auth.hasPermission('user.update') || selectedBranch == null) return;
    setState(() {
      loading = true;
      error = null;
    });
    final ok = await userService.assignBranchAccess(widget.userId, selectedBranch!);
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
    if (!auth.hasPermission('user.read')) {
      return const Center(child: Text('You do not have permission to view user access.'));
    }
    final canUpdate = auth.hasPermission('user.update');
    return AnimatedBuilder(
      animation: branchService,
      builder: (context, _) => Column(
        children: [
          if (accessLoading) const LinearProgressIndicator(),
          if (!accessLoading) ...[
            Align(
              alignment: Alignment.centerLeft,
              child: Text('Assigned branches', style: Theme.of(context).textTheme.titleSmall),
            ),
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerLeft,
              child: Text(
                assignedBranches.isEmpty
                    ? 'No branches assigned'
                    : assignedBranches.map((branch) => branch['name'].toString()).join(' • '),
              ),
            ),
            const Divider(),
          ],
          if (canUpdate) ...[
            DropdownButtonFormField<String>(
              items: branchService.branches
                  .map((branch) => DropdownMenuItem<String>(
                        value: branch['id'] as String?,
                        child: Text(branch['name'] ?? branch['code'] ?? ''),
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
          ],
          if (error != null)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Text(error!, style: const TextStyle(color: Colors.red)),
            ),
        ],
      ),
    );
  }
}
