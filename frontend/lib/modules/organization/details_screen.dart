import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import '../../core/auth/auth_service.dart';
import 'organization_service.dart';
import '../../presentation/ui/components/page_header.dart';

class OrganizationDetailsScreen extends StatefulWidget {
  final String id;
  const OrganizationDetailsScreen({Key? key, required this.id})
    : super(key: key);

  @override
  State<OrganizationDetailsScreen> createState() =>
      _OrganizationDetailsScreenState();
}

class _OrganizationDetailsScreenState extends State<OrganizationDetailsScreen> {
  Map<String, dynamic>? org;
  bool isLoading = true;
  String? error;
  late OrganizationService service;
  late AuthService auth;

  @override
  void initState() {
    super.initState();
    service = GetIt.instance.get<OrganizationService>();
    auth = GetIt.instance.get<AuthService>();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      isLoading = true;
      error = null;
    });
    final data = await service.getOrganization(widget.id);
    if (data == null) {
      setState(() {
        error = 'Organization not found';
        isLoading = false;
      });
      return;
    }
    setState(() {
      org = data;
      isLoading = false;
    });
  }

  Future<void> _deactivate() async {
    final permitted = auth.hasPermission('organization.manage');
    if (!permitted) return;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Confirm'),
        content: Text('Deactivate this organization?'),
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
      final success = await service.deactivateOrganization(widget.id);
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

    final permittedManage = auth.hasPermission('organization.manage');

    return Scaffold(
      appBar: AppBar(title: Text(org?['name'] ?? 'Organization')),
      body: Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ErpPageHeader(
              title: org?['name'] ?? 'Organization',
              subtitle: org?['legalName'] ?? null,
              breadcrumbs: [
                const ErpBreadcrumbItem(
                  label: 'Dashboard',
                  route: '/dashboard',
                ),
                const ErpBreadcrumbItem(
                  label: 'Organizations',
                  route: '/organizations',
                ),
                ErpBreadcrumbItem(label: org?['name'] ?? 'Details'),
              ],
            ),
            SizedBox(height: 8),
            Text('Code: ${org?['code'] ?? ''}'),
            SizedBox(height: 8),
            Text('Legal Name: ${org?['legalName'] ?? ''}'),
            SizedBox(height: 8),
            Text('Email: ${org?['email'] ?? ''}'),
            SizedBox(height: 8),
            Text('Phone: ${org?['phone'] ?? ''}'),
            SizedBox(height: 16),
            Row(
              children: [
                ElevatedButton(
                  onPressed: () => Navigator.of(
                    context,
                  ).pushNamed('/organizations/branches', arguments: widget.id),
                  child: Text('Branches'),
                ),
                SizedBox(width: 8),
                if (permittedManage) ...[
                  ElevatedButton(
                    onPressed: () => Navigator.of(context)
                        .pushNamed('/organizations/edit', arguments: widget.id),
                    child: Text('Edit'),
                  ),
                  SizedBox(width: 8),
                  ElevatedButton(
                    onPressed: _deactivate,
                    child: Text('Deactivate'),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}
