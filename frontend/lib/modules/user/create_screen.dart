import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import '../../core/auth/auth_service.dart';
import '../../modules/organization/organization_service.dart';
import 'user_service.dart';
import '../../presentation/ui/components/page_header.dart';

class UserCreateScreen extends StatefulWidget {
  const UserCreateScreen({super.key});
  @override
  State<UserCreateScreen> createState() => _UserCreateScreenState();
}

class _UserCreateScreenState extends State<UserCreateScreen> {
  final _formKey = GlobalKey<FormState>();
  final _username = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  String? _organizationId;
  String? _defaultBranchId;
  late final UserService service;
  late final OrganizationService orgService;
  late final AuthService auth;
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    service = GetIt.instance.get<UserService>();
    orgService = GetIt.instance.get<OrganizationService>();
    auth = GetIt.instance.get<AuthService>();
    orgService.fetchOrganizations();
  }

  @override
  void dispose() {
    _username.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _loading = true);
    final ok = await service.createUser({
      'username': _username.text.trim(),
      'email': _email.text.trim(),
      'password': _password.text,
      'organizationId': _organizationId,
      'defaultBranchId': _defaultBranchId,
    });
    if (!mounted) return;
    setState(() => _loading = false);
    if (ok) {
      Navigator.pop(context);
    } else {
      setState(() => _error = 'Failed to create user');
    }
  }

  @override
  Widget build(BuildContext context) {
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
                  const ErpPageHeader(
                    title: 'Create User',
                    subtitle: 'Create a user account and assign its context',
                    breadcrumbs: [
                      ErpBreadcrumbItem(label: 'Dashboard'),
                      ErpBreadcrumbItem(label: 'Users'),
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
                                  keyboardType: TextInputType.emailAddress,
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
                            const SizedBox(height: 18),
                            TextFormField(
                              controller: _password,
                              decoration: const InputDecoration(labelText: 'Password'),
                              obscureText: true,
                              validator: (v) => v == null || v.length < 6
                                  ? 'Minimum 6 characters.'
                                  : null,
                            ),
                            if (_error != null) ...[
                              const SizedBox(height: 12),
                              Text(_error!, style: const TextStyle(color: Colors.red)),
                            ],
                            const SizedBox(height: 24),
                            Align(
                              alignment: Alignment.centerRight,
                              child: FilledButton.icon(
                                onPressed: _loading ? null : _submit,
                                icon: _loading
                                    ? const SizedBox(
                                        width: 18,
                                        height: 18,
                                        child: CircularProgressIndicator(strokeWidth: 2),
                                      )
                                    : const Icon(Icons.person_add_outlined),
                                label: const Text('Create user'),
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
