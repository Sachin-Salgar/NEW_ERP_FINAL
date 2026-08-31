import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'package:provider/provider.dart';

import '../../core/network/api_client.dart';
import '../../core/auth/auth_service.dart';
import 'role_service.dart';

class RoleCreateScreen extends StatefulWidget {
  static const routeName = '/roles/create';

  const RoleCreateScreen({Key? key}) : super(key: key);

  @override
  State<RoleCreateScreen> createState() => _RoleCreateScreenState();
}

class _RoleCreateScreenState extends State<RoleCreateScreen> {
  final _formKey = GlobalKey<FormState>();
  final _codeCtrl = TextEditingController();
  final _nameCtrl = TextEditingController();
  final _descCtrl = TextEditingController();

  @override
  void dispose() {
    _codeCtrl.dispose();
    _nameCtrl.dispose();
    _descCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = GetIt.instance.get<AuthService>();

    return ChangeNotifierProvider(
      create: (_) => RoleService(apiClient: GetIt.instance.get<ApiClient>()),
      child: Consumer<RoleService>(builder: (context, svc, _) {
        final hasPermission = auth.hasPermission('role.manage');

        if (!hasPermission) {
          return Scaffold(
            appBar: AppBar(
              leading: IconButton(
                onPressed: () => Navigator.of(context).pop(),
                icon: const Icon(Icons.arrow_back_outlined),
              ),
              title: const Text('Create Role'),
            ),
            body: const Center(child: Text('You do not have permission to create roles.')),
          );
        }

        return Scaffold(
          appBar: AppBar(
            leading: IconButton(
              onPressed: () => Navigator.of(context).pop(),
              icon: const Icon(Icons.arrow_back_outlined),
            ),
            title: const Text('Create Role'),
          ),
          body: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  TextFormField(
                    controller: _codeCtrl,
                    decoration: const InputDecoration(labelText: 'Code'),
                    textInputAction: TextInputAction.next,
                    validator: (v) {
                      if (v == null || v.trim().isEmpty) return 'Role code is required.';
                      return null;
                    },
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _nameCtrl,
                    decoration: const InputDecoration(labelText: 'Name'),
                    textInputAction: TextInputAction.next,
                    validator: (v) {
                      if (v == null || v.trim().isEmpty) return 'Role name is required.';
                      return null;
                    },
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _descCtrl,
                    decoration: const InputDecoration(labelText: 'Description (optional)'),
                    textInputAction: TextInputAction.done,
                    maxLines: 2,
                  ),
                  const SizedBox(height: 20),
                  if (svc.error != null) ...[
                    Text('Error: ${svc.error}', style: const TextStyle(color: Colors.red)),
                    const SizedBox(height: 12),
                  ],
                  ElevatedButton(
                    onPressed: svc.isLoading
                        ? null
                        : () async {
                            if (!_formKey.currentState!.validate()) return;

                            final code = _codeCtrl.text.trim();
                            final name = _nameCtrl.text.trim();
                            final desc = _descCtrl.text.trim();

                            final created = await svc.createRole(code: code, name: name, description: desc.isEmpty ? null : desc);
                            if (created != null) {
                              // Show success (do not auto-pop) — keep on screen so tests can assert success message
                              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Role created')));
                            }
                          },
                    child: svc.isLoading ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Create'),
                  )
                ],
              ),
            ),
          ),
        );
      }),
    );
  }
}
