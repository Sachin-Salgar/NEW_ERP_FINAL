import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'package:provider/provider.dart';

import '../../core/network/api_client.dart';
import '../../core/auth/auth_service.dart';
import '../../presentation/ui/components/page_header.dart';
import 'role_service.dart';

class RoleEditScreen extends StatefulWidget {
  final String roleId;
  const RoleEditScreen({Key? key, required this.roleId}) : super(key: key);
  @override
  State<RoleEditScreen> createState() => _RoleEditScreenState();
}

class _RoleEditScreenState extends State<RoleEditScreen> {
  final _formKey = GlobalKey<FormState>();
  final _codeCtrl = TextEditingController();
  final _nameCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  bool _isSystem = false;
  bool _loadedOnce = false;

  @override
  void dispose() { _codeCtrl.dispose(); _nameCtrl.dispose(); _descCtrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final auth = GetIt.instance.get<AuthService>();
    return ChangeNotifierProvider(
      create: (_) => RoleService(apiClient: GetIt.instance.get<ApiClient>()),
      child: Consumer<RoleService>(builder: (context, svc, _) {
        if (!auth.hasPermission('role.manage')) return const Scaffold(body: Center(child: Text('You do not have permission to edit roles.')));
        if (!_loadedOnce && !svc.isLoading && svc.error == null) {
          WidgetsBinding.instance.addPostFrameCallback((_) async {
            final role = await svc.getRole(widget.roleId);
            if (!mounted) return;
            if (role != null) { _codeCtrl.text = role['code']?.toString() ?? ''; _nameCtrl.text = role['name']?.toString() ?? ''; _descCtrl.text = role['description']?.toString() ?? ''; _isSystem = role['isSystem'] == true; }
            _loadedOnce = true;
            setState(() {});
          });
        }
        return Scaffold(body: SafeArea(child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(24, 24, 24, 32),
          child: Center(child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 760),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const ErpPageHeader(title: 'Edit Role', subtitle: 'Update role identity and configuration', breadcrumbs: [ErpBreadcrumbItem(label: 'Dashboard'), ErpBreadcrumbItem(label: 'Roles'), ErpBreadcrumbItem(label: 'Edit')]),
              const SizedBox(height: 12),
              Card(child: Padding(padding: const EdgeInsets.all(24), child: Form(
                key: _formKey,
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  Text('Role information', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 20),
                  LayoutBuilder(builder: (context, c) {
                    final stacked = c.maxWidth < 600;
                    final fields = [
                      TextFormField(controller: _codeCtrl, decoration: const InputDecoration(labelText: 'Code'), textInputAction: TextInputAction.next, validator: (v) => v == null || v.trim().isEmpty ? 'Role code is required.' : null),
                      TextFormField(controller: _nameCtrl, decoration: const InputDecoration(labelText: 'Name'), textInputAction: TextInputAction.next, validator: (v) => v == null || v.trim().isEmpty ? 'Role name is required.' : null),
                    ];
                    return stacked ? Column(children: [fields[0], const SizedBox(height: 18), fields[1]]) : Row(children: [Expanded(child: fields[0]), const SizedBox(width: 18), Expanded(child: fields[1])]);
                  }),
                  const SizedBox(height: 18),
                  TextFormField(controller: _descCtrl, decoration: const InputDecoration(labelText: 'Description (optional)'), maxLines: 3),
                  const SizedBox(height: 12),
                  CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('System role'),
                    subtitle: const Text('Use only when this role is intended to be a protected system role.'),
                    value: _isSystem,
                    onChanged: (v) => setState(() => _isSystem = v ?? false),
                  ),
                  if (svc.error != null) ...[const SizedBox(height: 12), Text('Error: ${svc.error}', style: TextStyle(color: Colors.red.shade700))],
                  const SizedBox(height: 24),
                  Align(alignment: Alignment.centerRight, child: FilledButton.icon(
                    onPressed: svc.isLoading ? null : () async {
                      if (!_formKey.currentState!.validate()) return;
                      final updated = await svc.updateRole(roleId: widget.roleId, code: _codeCtrl.text.trim().isEmpty ? null : _codeCtrl.text.trim(), name: _nameCtrl.text.trim().isEmpty ? null : _nameCtrl.text.trim(), description: _descCtrl.text.trim().isEmpty ? null : _descCtrl.text.trim(), isSystem: _isSystem);
                      if (updated != null && mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Role updated')));
                    },
                    icon: svc.isLoading ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.save_outlined),
                    label: const Text('Save'),
                  )),
                ]),
              ))),
            ],),
          )),
        )));
      }),
    );
  }
}
