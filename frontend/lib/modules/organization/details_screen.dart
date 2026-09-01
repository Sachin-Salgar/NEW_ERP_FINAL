import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import '../../core/auth/auth_service.dart';
import '../../presentation/ui/components/back_button.dart';
import 'organization_service.dart';
import '../../presentation/ui/components/page_header.dart';

class OrganizationDetailsScreen extends StatefulWidget {
  final String id;
  const OrganizationDetailsScreen({super.key, required this.id});
  @override
  State<OrganizationDetailsScreen> createState() =>
      _OrganizationDetailsScreenState();
}

class _OrganizationDetailsScreenState extends State<OrganizationDetailsScreen> {
  Map<String, dynamic>? org;
  bool loading = true;
  String? error;
  late final OrganizationService service;
  late final AuthService auth;
  @override
  void initState() {
    super.initState();
    service = GetIt.instance.get<OrganizationService>();
    auth = GetIt.instance.get<AuthService>();
    _load();
  }

  Future<void> _load() async {
    final d = await service.getOrganization(widget.id);
    if (!mounted) return;
    if (d == null) {
      setState(() {
        loading = false;
        error = 'Organization not found';
      });
      return;
    }
    setState(() {
      org = d;
      loading = false;
    });
  }

  Future<void> _deactivate() async {
    if (!auth.hasPermission('organization.manage')) return;
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Deactivate organization?'),
        content: const Text('This will deactivate the organization.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(c, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(c, true),
            child: const Text('Deactivate'),
          ),
        ],
      ),
    );
    if (ok == true &&
        await service.deactivateOrganization(widget.id) &&
        mounted)
      Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    if (loading)
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    if (org == null)
      return Scaffold(
        body: Center(child: Text(error ?? 'Organization not found')),
      );
    final manage = auth.hasPermission('organization.manage');
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(24, 24, 24, 32),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 900),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ErpPageHeader(
                    title: org!['name'] ?? 'Organization',
                    subtitle: org!['legalName'] ?? '',
                    breadcrumbs: const [
                      ErpBreadcrumbItem(label: 'Dashboard'),
                      ErpBreadcrumbItem(label: 'Organizations'),
                      ErpBreadcrumbItem(label: 'Details'),
                    ],
                    actions: [
                      SettingsBackButton(
                        parentRoute: '/settings/organizations',
                      ),
                      if (manage)
                        FilledButton.icon(
                          onPressed: () => Navigator.pushNamed(
                            context,
                            '/settings/organizations/edit/${widget.id}',
                          ),
                          icon: const Icon(Icons.edit_outlined),
                          label: const Text('Edit'),
                        ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            'Organization information',
                            style: Theme.of(context).textTheme.titleMedium
                                ?.copyWith(fontWeight: FontWeight.w700),
                          ),
                          const SizedBox(height: 20),
                          Wrap(
                            spacing: 40,
                            runSpacing: 24,
                            children: [
                              _Info('Code', org!['code']),
                              _Info('Name', org!['name']),
                              _Info('Legal name', org!['legalName']),
                              _Info('Email', org!['email']),
                              _Info('Phone', org!['phone']),
                              _Info('Website', org!['website']),
                              _Info('GST No.', org!['gstNo']),
                              _Info('PAN No.', org!['panNo']),
                              _Info('CIN No.', org!['cinNo']),
                              _Info('Currency', org!['baseCurrency']),
                              _Info('Fiscal calendar', org!['fiscalCalendar']),
                              _Info('Status', org!['status']),
                              _Info('Default', org!['isDefault'] == true ? 'Yes' : 'No'),
                              _Info('Remarks', org!['remarks']),
                            ],
                          ),
                          const SizedBox(height: 28),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: [
                              OutlinedButton.icon(
                                onPressed: () => Navigator.pushNamed(
                                  context,
                                  '/settings/branches',
                                  arguments: widget.id,
                                ),
                                icon: const Icon(Icons.store_outlined),
                                label: const Text('Branches'),
                              ),
                              if (manage)
                                FilledButton.icon(
                                  onPressed: _deactivate,
                                  icon: const Icon(Icons.block_outlined),
                                  label: const Text('Deactivate'),
                                ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Info extends StatelessWidget {
  final String label;
  final dynamic value;
  const _Info(this.label, this.value);
  @override
  Widget build(BuildContext context) => SizedBox(
    width: 220,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: Theme.of(context).textTheme.labelMedium),
        const SizedBox(height: 6),
        Text(
          value?.toString() ?? '—',
          style: Theme.of(context).textTheme.bodyLarge
              ?.copyWith(fontWeight: FontWeight.w600),
        ),
      ],
    ),
  );
}
