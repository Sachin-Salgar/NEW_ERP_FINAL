import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import '../../core/auth/auth_service.dart';
import '../../presentation/ui/components/back_button.dart';
import 'user_service.dart';
import '../../presentation/ui/components/page_header.dart';

class UserEditScreen extends StatefulWidget {
  final String? id;

  const UserEditScreen({super.key, this.id});

  @override
  State<UserEditScreen> createState() => _UserEditScreenState();
}

class _UserEditScreenState extends State<UserEditScreen> {
  final _formKey = GlobalKey<FormState>();
  final _username = TextEditingController();
  final _email = TextEditingController();
  String? _organizationId;
  String? _defaultBranchId;
  late final UserService service;
  late final AuthService auth;
  Map<String, dynamic>? user;
  bool loading = true;
  bool saving = false;
  String? error;

  @override
  void initState() {
    super.initState();
    service = GetIt.instance.get<UserService>();
    auth = GetIt.instance.get<AuthService>();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final resolvedId = widget.id ?? (ModalRoute.of(context)?.settings.arguments as String?);
    if (resolvedId != null && resolvedId.isNotEmpty && user == null) _load(resolvedId);
  }

  @override
  void dispose() {
    _username.dispose();
    _email.dispose();
    super.dispose();
  }

  Future<void> _load(String id) async {
    setState(() => loading = true);
    final u = await service.getUser(id);
    if (!mounted) return;
    if (u == null) {
      setState(() {
        loading = false;
        error = 'User not found';
      });
      return;
    }
    user = u;
    _username.text = u['username'] ?? '';
    _email.text = u['email'] ?? '';
    _organizationId = u['organizationId'] as String?;
    _defaultBranchId = u['defaultBranchId'] as String?;
    setState(() => loading = false);
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate() || user == null) return;
    setState(() => saving = true);
    final ok = await service.updateUser(user!['id'], {
      'username': _username.text.trim(),
      'email': _email.text.trim(),
      'organizationId': _organizationId,
      'defaultBranchId': _defaultBranchId,
    });
    if (!mounted) return;
    setState(() => saving = false);
    if (ok) {
      Navigator.pop(context);
    } else {
      setState(() => error = 'Failed to update user');
    }
  }

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (!auth.hasPermission('user.manage')) {
      return const Scaffold(
        body: Center(child: Text('You do not have permission to manage users.')),
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
                  ErpPageHeader(
                    title: 'Edit User',
                    subtitle: 'Update user account information',
                    breadcrumbs: const [
                      ErpBreadcrumbItem(label: 'Dashboard'),
                      ErpBreadcrumbItem(label: 'Users'),
                      ErpBreadcrumbItem(label: 'Edit'),
                    ],
                    actions: [
                      SettingsBackButton(
                        parentRoute: '/settings/users',
                      ),
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
                              'Account information',
                              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(height: 20),
                            LayoutBuilder(
                              builder: (context, c) {
                                final a = TextFormField(
                                  controller: _username,
                                  decoration: const InputDecoration(labelText: 'Username'),
                                  validator: (v) => v == null || v.trim().isEmpty
                                      ? 'Username is required.'
                                      : null,
                                );
                                final b = TextFormField(
                                  controller: _email,
                                  decoration: const InputDecoration(labelText: 'Email'),
                                  validator: (v) => v == null || v.trim().isEmpty
                                      ? 'Email is required.'
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
                            if (error != null) ...[
                              const SizedBox(height: 12),
                              Text(error!, style: const TextStyle(color: Colors.red)),
                            ],
                            const SizedBox(height: 24),
                            Align(
                              alignment: Alignment.centerRight,
                              child: FilledButton.icon(
                                onPressed: saving ? null : _submit,
                                icon: saving
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
