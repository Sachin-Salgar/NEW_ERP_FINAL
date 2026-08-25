import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import '../../core/auth/auth_service.dart';
import 'branch_service.dart';

class BranchDetailsScreen extends StatefulWidget {
  final String organizationId;
  final String branchId;
  const BranchDetailsScreen({
    Key? key,
    required this.organizationId,
    required this.branchId,
  }) : super(key: key);

  @override
  State<BranchDetailsScreen> createState() => _BranchDetailsScreenState();
}

class _BranchDetailsScreenState extends State<BranchDetailsScreen> {
  Map<String, dynamic>? branch;
  bool isLoading = true;
  String? error;
  late BranchService service;
  late AuthService auth;

  @override
  void initState() {
    super.initState();
    service = GetIt.instance.get<BranchService>();
    auth = GetIt.instance.get<AuthService>();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      isLoading = true;
      error = null;
    });
    final data = await service.getBranch(
      widget.organizationId,
      widget.branchId,
    );
    if (data == null) {
      setState(() {
        error = 'Branch not found';
        isLoading = false;
      });
      return;
    }
    setState(() {
      branch = data;
      isLoading = false;
    });
  }

  Future<void> _deactivate() async {
    final permitted = auth.hasPermission('branch.manage');
    if (!permitted) return;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Confirm'),
        content: Text('Deactivate this branch?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text('Deactivate'),
          ),
        ],
      ),
    );
    if (ok == true) {
      final success = await service.deactivateBranch(
        widget.organizationId,
        widget.branchId,
      );
      if (success) {
        Navigator.of(context).pop();
      } else {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Failed to deactivate')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (isLoading)
      return Scaffold(body: Center(child: CircularProgressIndicator()));
    if (error != null)
      return Scaffold(body: Center(child: Text('Error: $error')));

    final permittedManage = auth.hasPermission('branch.manage');

    return Scaffold(
      appBar: AppBar(title: Text(branch?['name'] ?? 'Branch')),
      body: Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Code: ${branch?['code'] ?? ''}'),
            SizedBox(height: 8),
            Text('City: ${branch?['city'] ?? ''}'),
            SizedBox(height: 8),
            Text('Address: ${branch?['addressLine1'] ?? ''}'),
            SizedBox(height: 16),
            if (permittedManage)
              Row(
                children: [
                  ElevatedButton(
                    onPressed: () => Navigator.of(context).pushNamed(
                      '/organizations/branches/edit',
                      arguments: {
                        'organizationId': widget.organizationId,
                        'branchId': widget.branchId,
                      },
                    ),
                    child: Text('Edit'),
                  ),
                  SizedBox(width: 8),
                  ElevatedButton(
                    onPressed: _deactivate,
                    child: Text('Deactivate'),
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }
}
