import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import '../../core/auth/auth_service.dart';
import 'branch_service.dart';
import '../../presentation/ui/components/page_header.dart';

class EditBranchScreen extends StatefulWidget {
  final String organizationId;
  final String branchId;
  const EditBranchScreen({super.key, required this.organizationId, required this.branchId});

  @override
  State<EditBranchScreen> createState() => _EditBranchScreenState();
}

class _EditBranchScreenState extends State<EditBranchScreen> {
  final _formKey = GlobalKey<FormState>();
  final _code = TextEditingController();
  final _name = TextEditingController();
  final _city = TextEditingController();
  late final BranchService service;
  late final AuthService auth;
  bool _loading = true;
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    service = GetIt.instance.get<BranchService>();
    auth = GetIt.instance.get<AuthService>();
    _load();
  }

  @override
  void dispose() {
    _code.dispose();
    _name.dispose();
    _city.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final d = await service.getBranch(widget.organizationId, widget.branchId);
    if (!mounted) return;
    if (d == null) {
      setState(() => _error = 'Branch not found');
      return;
    }
    _code.text = d['code'] ?? '';
    _name.text = d['name'] ?? '';
    _city.text = d['city'] ?? '';
    setState(() => _loading = false);
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _submitting = true);
    final ok = await service.updateBranch(widget.organizationId, widget.branchId, {
      'code': _code.text.trim(),
      'name': _name.text.trim(),
      'city': _city.text.trim(),
    });
    if (!mounted) return;
    setState(() => _submitting = false);
    if (ok) {
      Navigator.of(context).pop();
    } else {
      setState(() => _error = 'Failed to update branch');
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (!auth.hasPermission('branch.manage')) {
      return const Scaffold(
        body: Center(child: Text('You do not have permission to manage branches.')),
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
                    title: 'Edit Branch',
                    subtitle: 'Update branch information',
                    breadcrumbs: [
                      ErpBreadcrumbItem(label: 'Dashboard'),
                      ErpBreadcrumbItem(label: 'Organizations'),
                      ErpBreadcrumbItem(label: 'Branches'),
                      ErpBreadcrumbItem(label: 'Edit'),
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
                              'Branch information',
                              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(height: 20),
                            LayoutBuilder(
                              builder: (context, c) {
                                final a = TextFormField(
                                  controller: _code,
                                  decoration: const InputDecoration(labelText: 'Code'),
                                  validator: (v) => v == null || v.trim().isEmpty
                                      ? 'Code is required.'
                                      : null,
                                );
                                final b = TextFormField(
                                  controller: _name,
                                  decoration: const InputDecoration(labelText: 'Name'),
                                  validator: (v) => v == null || v.trim().isEmpty
                                      ? 'Name is required.'
                                      : null,
                                );
                                return c.maxWidth < 600
                                    ? Column(children: [a, const SizedBox(height: 18), b])
                                    : Row(
                                        children: [
                                          Expanded(child: a),
                                          const SizedBox(width: 18),
                                          Expanded(child: b),
                                        ],
                                      );
                              },
                            ),
                            const SizedBox(height: 18),
                            TextFormField(
                              controller: _city,
                              decoration: const InputDecoration(labelText: 'City'),
                            ),
                            if (_error != null) ...[
                              const SizedBox(height: 12),
                              Text(_error!, style: const TextStyle(color: Colors.red)),
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
                                    : const Icon(Icons.save_outlined),
                                label: const Text('Save changes'),
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
