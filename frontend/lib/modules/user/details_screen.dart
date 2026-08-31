import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import '../../core/auth/auth_service.dart';
import 'user_service.dart';
import '../../presentation/ui/components/page_header.dart';

class UserDetailsScreen extends StatefulWidget {
  const UserDetailsScreen({super.key});
  @override
  State<UserDetailsScreen> createState() => _UserDetailsScreenState();
}

class _UserDetailsScreenState extends State<UserDetailsScreen> {
  final service = GetIt.instance.get<UserService>();
  final auth = GetIt.instance.get<AuthService>();
  Map<String, dynamic>? user;
  bool loading = true;
  String? error;
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final id = ModalRoute.of(context)!.settings.arguments as String?;
    if (id != null && user == null) _load(id);
  }

  @override
  Future<void> didUpdateWidget(covariant UserDetailsScreen oldWidget) async {
    super.didUpdateWidget(oldWidget);
  }

  @override
  void dispose() {
    super.dispose();
  }

  Future<void> _load(String id) async {
    setState(() => loading = true);
    final u = await service.getUser(id);
    if (!mounted) return;
    setState(() {
      user = u;
      loading = false;
      error = u == null ? 'User not found' : null;
    });
  }

  Future<void> _activate() async {
    if (user == null) return;
    if (await service.activateUser(user!['id'])) await _load(user!['id']);
  }

  Future<void> _deactivate() async {
    if (user == null) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Deactivate user?'),
        content: const Text('This will deactivate the account.'),
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
    if (confirmed == true && await service.deactivateUser(user!['id']))
      await _load(user!['id']);
  }

  @override
  Widget build(BuildContext context) {
    if (loading)
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    if (user == null)
      return Scaffold(body: Center(child: Text(error ?? 'User not found')));
    final manage = auth.hasPermission('user.manage');
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
                    title: user!['username'] ?? 'User details',
                    subtitle: user!['email'] ?? '',
                    breadcrumbs: const [
                      ErpBreadcrumbItem(label: 'Dashboard'),
                      ErpBreadcrumbItem(label: 'Users'),
                      ErpBreadcrumbItem(label: 'Details'),
                    ],
                    actions: manage
                        ? [
                            FilledButton.icon(
                              onPressed: () => Navigator.pushNamed(
                                context,
                                '/settings/users/edit',
                                arguments: user!['id'],
                              ),
                              icon: const Icon(Icons.edit_outlined),
                              label: const Text('Edit'),
                            ),
                          ]
                        : null,
                  ),
                  const SizedBox(height: 12),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
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
                                _Info(
                                  label: 'Username',
                                  value: user!['username'],
                                ),
                                _Info(label: 'Email', value: user!['email']),
                                _Info(label: 'Status', value: user!['status']),
                              ];
                              return c.maxWidth < 600
                                  ? Column(children: data)
                                  : Wrap(
                                      spacing: 40,
                                      runSpacing: 24,
                                      children: data,
                                    );
                            },
                          ),
                          if (error != null) ...[
                            const SizedBox(height: 12),
                            Text(error!, style: TextStyle(color: Colors.red)),
                          ],
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
                              if (manage)
                                OutlinedButton.icon(
                                  onPressed: () => Navigator.pushNamed(
                                    context,
                                    '/settings/users/roles',
                                    arguments: user!['id'],
                                  ),
                                  icon: const Icon(Icons.assignment_outlined),
                                  label: const Text('Assign Roles'),
                                ),
                              if (manage)
                                OutlinedButton.icon(
                                  onPressed: () => Navigator.pushNamed(
                                    context,
                                    '/settings/users/access',
                                    arguments: user!['id'],
                                  ),
                                  icon: const Icon(Icons.security_outlined),
                                  label: const Text('Manage Access'),
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
          style: Theme.of(context).textTheme.bodyLarge
              ?.copyWith(fontWeight: FontWeight.w600),
        ),
      ],
    ),
  );
}
