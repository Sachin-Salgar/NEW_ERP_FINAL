import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import '../../core/auth/auth_service.dart';
import 'organization_service.dart';
import '../../presentation/ui/components/page_header.dart';

class CreateOrganizationScreen extends StatefulWidget {
  const CreateOrganizationScreen({super.key});

  @override
  State<CreateOrganizationScreen> createState() => _CreateOrganizationScreenState();
}

class _CreateOrganizationScreenState extends State<CreateOrganizationScreen> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _legalName = TextEditingController();

  late final OrganizationService service;
  late final AuthService auth;

  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    service = GetIt.instance.get<OrganizationService>();
    auth = GetIt.instance.get<AuthService>();
  }

  @override
  void dispose() {
    _name.dispose();
    _legalName.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _submitting = true;
      _error = null;
    });

    final success = await service.createOrganization({
      'name': _name.text.trim(),
      'legalName': _legalName.text.trim(),
    });

    if (!mounted) return;

    setState(() => _submitting = false);

    if (success) {
      Navigator.of(context).pop();
    } else {
      setState(() => _error = 'Failed to create organization');
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!auth.hasPermission('organization.manage')) {
      return const Scaffold(
        body: Center(
          child: Text('You do not have permission to manage organizations.'),
        ),
      );
    }

    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(24, 24, 24, 32),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 760),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const ErpPageHeader(
                    title: 'Create Organization',
                    subtitle: 'Add a new organization to the ERP',
                    breadcrumbs: [
                      ErpBreadcrumbItem(label: 'Dashboard'),
                      ErpBreadcrumbItem(label: 'Organizations'),
                      ErpBreadcrumbItem(label: 'Create'),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Form(
                        key: _formKey,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Text(
                              'Organization information',
                              style: Theme.of(context)
                                  .textTheme
                                  .titleMedium
                                  ?.copyWith(fontWeight: FontWeight.w700),
                            ),
                            const SizedBox(height: 20),
                            LayoutBuilder(
                              builder: (context, constraints) {
                                final nameField = TextFormField(
                                  controller: _name,
                                  decoration: const InputDecoration(labelText: 'Name'),
                                  validator: (value) =>
                                      value == null || value.trim().isEmpty
                                          ? 'Name is required.'
                                          : null,
                                );

                                if (constraints.maxWidth < 600) {
                                  return Column(
                                    children: [
                                      nameField,
                                    ],
                                  );
                                }

                                return Row(
                                  children: [
                                    Expanded(child: nameField),
                                  ],
                                );
                              },
                            ),
                            const SizedBox(height: 18),
                            TextFormField(
                              controller: _legalName,
                              decoration: const InputDecoration(labelText: 'Legal name'),
                            ),
                            if (_error != null) ...[
                              const SizedBox(height: 12),
                              Text(
                                _error!,
                                style: const TextStyle(color: Colors.red),
                              ),
                            ],
                            const SizedBox(height: 24),
                            Align(
                              alignment: Alignment.centerRight,
                              child: FilledButton.icon(
                                onPressed: _submitting ? null : _submit,
                                icon: _submitting
                                    ? const SizedBox(
                                        width: 18,
                                        height: 18,
                                        child: CircularProgressIndicator(strokeWidth: 2),
                                      )
                                    : const Icon(Icons.add),
                                label: const Text('Create organization'),
                              ),
                            ),
                          ],
                        ),
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
