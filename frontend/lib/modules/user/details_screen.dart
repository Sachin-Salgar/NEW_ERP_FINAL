import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import '../../core/auth/auth_service.dart';
import '../../presentation/ui/components/back_button.dart';
import 'user_service.dart';
import 'user_role_assignment_screen.dart';
import 'access_screen.dart';
import '../../presentation/ui/components/page_header.dart';

class UserDetailsScreen extends StatefulWidget {
  final String? id;

  const UserDetailsScreen({super.key, this.id});

  @override
  State<UserDetailsScreen> createState() => _UserDetailsScreenState();
}

class _UserDetailsScreenState extends State<UserDetailsScreen> {
  final service = GetIt.instance.get<UserService>();
  final auth = GetIt.instance.get<AuthService>();
  Map<String, dynamic>? user;
  bool loading = true;
  String? error;
  int _selectedSection = 0;
  bool _editing = false;
  final _formKey = GlobalKey<FormState>();
  final _username = TextEditingController();
  final _email = TextEditingController();
  bool _saving = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final routeId = widget.id ?? (ModalRoute.of(context)?.settings.arguments as String?);
    if (routeId != null && routeId.isNotEmpty && user == null) _load(routeId);
  }

  @override
  Future<void> didUpdateWidget(covariant UserDetailsScreen oldWidget) async {
    super.didUpdateWidget(oldWidget);
  }

  @override
  void dispose() {
    _username.dispose();
    _email.dispose();
    super.dispose();
  }

  Future<void> _load(String id) async {
    if (!mounted) return;
    setState(() => loading = true);
    final u = await service.getUser(id);
    if (!mounted) return;
    setState(() {
      user = u;
      _username.text = u?['username']?.toString() ?? '';
      _email.text = u?['email']?.toString() ?? '';
      loading = false;
      error = u == null ? 'User not found' : null;
    });
  }

  Future<void> _saveProfile() async {
    if (!(_formKey.currentState?.validate() ?? false) || user == null) return;
    setState(() => _saving = true);
    final ok = await service.updateUser(user!['id'].toString(), {
      'username': _username.text.trim(),
      'email': _email.text.trim(),
      'organizationId': user!['organizationId'],
      'defaultBranchId': user!['defaultBranchId'],
    });
    if (!mounted) return;
    if (ok) {
      final refreshed = await service.getUser(user!['id'].toString());
      if (!mounted) return;
      setState(() {
        user = refreshed ??
            {
              ...user!,
              'username': _username.text.trim(),
              'email': _email.text.trim(),
            };
        _editing = false;
        _saving = false;
      });
      return;
    }
    setState(() {
      _saving = false;
      error = 'Failed to update user';
    });
  }

  Future<void> _activate() async {
    if (user == null) return;
    if (await service.activateUser(user!['id'])) {
      if (!mounted) return;
      await _load(user!['id']);
    }
  }

  Future<void> _deactivate() async {
    if (user == null) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Deactivate user?'),
        content: const Text('This will deactivate the account.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('Deactivate')),
        ],
      ),
    );
    if (confirmed == true && await service.deactivateUser(user!['id'])) {
      if (!mounted) return;
      await _load(user!['id']);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (loading) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    if (user == null) return Scaffold(body: Center(child: Text(error ?? 'User not found')));
    final manage = auth.hasPermission('user.manage');
    final profile = Card(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: _editing
            ? Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    TextFormField(
                      controller: _username,
                      decoration: const InputDecoration(labelText: 'Username'),
                      validator: (v) => v == null || v.trim().isEmpty
                          ? 'Username is required.'
                          : null,
                    ),
                    const SizedBox(height: 18),
                    TextFormField(
                      controller: _email,
                      decoration: const InputDecoration(labelText: 'Email'),
                      validator: (v) => v == null || v.trim().isEmpty
                          ? 'Email is required.'
                          : null,
                    ),
                    if (error != null)
                      Text(error!, style: const TextStyle(color: Colors.red)),
                    const SizedBox(height: 20),
                    Wrap(
                      spacing: 8,
                      children: [
                        FilledButton(
                          onPressed: _saving ? null : _saveProfile,
                          child: _saving
                              ? const CircularProgressIndicator()
                              : const Text('Save changes'),
                        ),
                        OutlinedButton(
                          onPressed: _saving
                              ? null
                              : () => setState(() => _editing = false),
                          child: const Text('Cancel'),
                        ),
                      ],
                    ),
                  ],
                ),
              )
            : Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'Account details',
                    style: Theme.of(context).textTheme.titleMedium
                        ?.copyWith(fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 20),
                  LayoutBuilder(
                    builder: (context, c) {
                      final data = [
                        _Info(label: 'Username', value: user!['username']),
                        _Info(label: 'Email', value: user!['email']),
                        _Info(label: 'Status', value: user!['status']),
                      ];
                      return c.maxWidth < 600
                          ? Column(children: data)
                          : Wrap(spacing: 40, runSpacing: 24, children: data);
                    },
                  ),
                  if (error != null)
                    Text(error!, style: const TextStyle(color: Colors.red)),
                  const SizedBox(height: 28),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      if (manage && user!['status'] != 'active')
                        FilledButton.icon(
                          onPressed: _activate,
                          icon: const Icon(Icons.check_circle_outline),
                          label: const Text('Activate'),
                        ),
                      if (manage && user!['status'] == 'active')
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
    );
    return Scaffold(
      body: SafeArea(
        child: DefaultTabController(
          length: 3,
          child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(24, 24, 24, 32),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 900),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ErpPageHeader(
                    title: user!['username'] ?? 'User details',
                    subtitle: user!['email'] ?? '',
                    breadcrumbs: const [
                      ErpBreadcrumbItem(label: 'Dashboard'),
                      ErpBreadcrumbItem(label: 'Users'),
                      ErpBreadcrumbItem(label: 'Details'),
                    ],
                    actions: [
                      SettingsBackButton(
                        parentRoute: '/settings/users',
                      ),
                      if (manage)
                        FilledButton.icon(
                          onPressed: () => setState(() => _editing = true),
                          icon: const Icon(Icons.edit_outlined),
                          label: const Text('Edit'),
                        ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  TabBar(
                    onTap: (index) => setState(() => _selectedSection = index),
                    tabs: const [
                      Tab(text: 'Profile'),
                      Tab(text: 'Roles'),
                      Tab(text: 'Access'),
                    ],
                  ),
                  const SizedBox(height: 16),
                  if (_selectedSection == 0) profile,
                  if (_selectedSection == 1)
                    SizedBox(
                      height: 520,
                      child: UserRoleAssignmentScreen(
                        userId: user!['id'].toString(),
                        embedded: true,
                      ),
                    ),
                  if (_selectedSection == 2)
                    UserAccessScreen(
                      userId: user!['id'].toString(),
                      embedded: true,
                    ),
                ],
              ),
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
  const _Info({required this.label, required this.value});
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
          style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w600),
        ),
      ],
    ),
  );
}
