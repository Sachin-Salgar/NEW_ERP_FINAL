import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import '../../core/auth/auth_service.dart';
import '../../modules/organization/organization_service.dart';
import '../../modules/branch/branch_service.dart';
import 'user_service.dart';

class UserAccessScreen extends StatefulWidget {
  final String? userId;
  final bool embedded;

  const UserAccessScreen({Key? key, this.userId, this.embedded = false})
    : super(key: key);

  @override
  State<UserAccessScreen> createState() => _UserAccessScreenState();
}

class _UserAccessScreenState extends State<UserAccessScreen> {
  final userService = GetIt.instance.get<UserService>();
  final auth = GetIt.instance.get<AuthService>();
  final orgService = GetIt.instance.get<OrganizationService>();
  final branchService = GetIt.instance.get<BranchService>();

  String? selectedOrg;
  String? selectedBranch;
  bool loading = false;
  String? error;
  Map<String, dynamic>? user;
  String? _loadedUserId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && !orgService.isLoading) orgService.fetchOrganizations();
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final id =
        widget.userId ??
        (ModalRoute.of(context)?.settings.arguments as String?);
    if (id != null && id.isNotEmpty && _loadedUserId != id) {
      _loadedUserId = id;
      _loadUser(id);
    }
  }

  Future<void> _loadUser(String id) async {
    final u = await userService.getUser(id);
    if (!mounted) return;
    setState(() => user = u);
  }

  Future<void> _assignOrg(String userId) async {
    if (selectedOrg == null) return;
    setState(() {
      loading = true;
      error = null;
    });
    final ok = await userService.assignOrganizationAccess(userId, selectedOrg!);
    if (!mounted) return;
    setState(() {
      loading = false;
    });
    if (!ok) {
      setState(() => error = 'Failed to assign organization');
    } else {
      await _loadUser(userId);
    }
  }

  Future<void> _assignBranch(String userId) async {
    if (selectedBranch == null) return;
    setState(() {
      loading = true;
      error = null;
    });
    final ok = await userService.assignBranchAccess(userId, selectedBranch!);
    if (!mounted) return;
    setState(() {
      loading = false;
    });
    if (!ok) {
      setState(() => error = 'Failed to assign branch');
    } else {
      await _loadUser(userId);
    }
  }

  @override
  Widget build(BuildContext context) {
    final userId =
        widget.userId ??
        (ModalRoute.of(context)?.settings.arguments as String?);
    if (!auth.hasPermission('user.manage')) {
      final message = const Center(
        child: Text('You do not have permission to manage user access.'),
      );
      return widget.embedded
          ? message
          : Scaffold(
              appBar: AppBar(title: const Text('User Access')),
              body: message,
            );
    }

    final content = AnimatedBuilder(
      animation: orgService,
      builder: (context, _) => AnimatedBuilder(
        animation: branchService,
        builder: (context, _) => Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            children: [
              if (orgService.isLoading) const LinearProgressIndicator(),
              DropdownButtonFormField<String>(
                items: orgService.organizations
                    .map<DropdownMenuItem<String>>(
                      (o) => DropdownMenuItem<String>(
                        value: o['id'] as String?,
                        child: Text(o['name'] ?? o['code'] ?? ''),
                      ),
                    )
                    .toList(),
                onChanged: (v) {
                  setState(() {
                    selectedOrg = v;
                    selectedBranch = null;
                  });
                  if (v != null) branchService.fetchBranches(v);
                },
                decoration: const InputDecoration(labelText: 'Organization'),
              ),
              const SizedBox(height: 8),
              ElevatedButton(
                onPressed: userId == null ? null : () => _assignOrg(userId),
                child: const Text('Assign Organization'),
              ),
              const Divider(),
              DropdownButtonFormField<String>(
                items: branchService.branches
                    .map<DropdownMenuItem<String>>(
                      (b) => DropdownMenuItem<String>(
                        value: b['id'] as String?,
                        child: Text(b['name'] ?? b['code'] ?? ''),
                      ),
                    )
                    .toList(),
                onChanged: (v) => setState(() => selectedBranch = v),
                decoration: const InputDecoration(labelText: 'Branch'),
              ),
              const SizedBox(height: 8),
              ElevatedButton(
                onPressed: userId == null ? null : () => _assignBranch(userId),
                child: const Text('Assign Branch'),
              ),
              if (error != null)
                Padding(
                  padding: const EdgeInsets.only(top: 12.0),
                  child: Text(
                    error!,
                    style: const TextStyle(color: Colors.red),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
    if (widget.embedded) return content;
    return Scaffold(
      appBar: AppBar(title: const Text('User Access')),
      body: content,
    );
  }
}
