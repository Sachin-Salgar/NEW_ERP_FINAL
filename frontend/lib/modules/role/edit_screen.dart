import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'package:provider/provider.dart';

import '../../core/network/api_client.dart';
import '../../core/auth/auth_service.dart';
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

  @override
  void dispose() {
    _codeCtrl.dispose();
    _nameCtrl.dispose();
    _descCtrl.dispose();
    super.dispose();
  }

  bool _loadedOnce = false;

  @override
  void initState() {
    super.initState();
  }

  @override
  Widget build(BuildContext context) {
    final auth = GetIt.instance.get<AuthService>();

    return ChangeNotifierProvider(
      create: (_) => RoleService(apiClient: GetIt.instance.get<ApiClient>()),
      child: Consumer<RoleService>(builder: (context, svc, _) {
        final hasPermission = auth.hasPermission('role.manage');

        // Trigger loading of the role once the provider is available
        if (! _loadedOnce && !svc.isLoading && svc.error == null) {
          WidgetsBinding.instance.addPostFrameCallback((_) async {
            final role = await svc.getRole(widget.roleId);
            if (role != null) {
              _codeCtrl.text = role['code']?.toString() ?? '';
              _nameCtrl.text = role['name']?.toString() ?? '';
              _descCtrl.text = role['description']?.toString() ?? '';
              _isSystem = role['isSystem'] == true;
            }
            _loadedOnce = true;
            setState(() {});
          });
        }

        if (!hasPermission) {
          return Scaffold(
            appBar: AppBar(title: const Text('Edit Role')),
            body: const Center(child: Text('You do not have permission to edit roles.')),
          );
        }

        return Scaffold(
          appBar: AppBar(title: const Text('Edit Role')),
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
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Checkbox(
                        value: _isSystem,
                        onChanged: (v) {
                          setState(() {
                            _isSystem = v ?? false;
                          });
                        },
                      ),
                      const SizedBox(width: 8),
                      const Text('System role'),
                    ],
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

                            final updated = await svc.updateRole(
                              roleId: widget.roleId,
                              code: code.isEmpty ? null : code,
                              name: name.isEmpty ? null : name,
                              description: desc.isEmpty ? null : desc,
                              isSystem: _isSystem,
                            );

                            if (updated != null) {
                              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Role updated')));
                            }
                          },
                    child: svc.isLoading
                        ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Text('Save'),
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
